package main

import (
	"archive/zip"
	"flag"
	"fmt"
	"io"
	"log"
	"math"
	"net"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/basicauth"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/gofiber/fiber/v3/middleware/static"
)

var (
	current = ""
	upload  = ""
	dist    = ""
	root    = flag.String("root", "", "where the files are")
	port    = flag.Int("port", 8080, "listen to some port")
)

func init() {
	flag.Parse()

	executable, err := os.Executable()
	if err != nil {
		panic(err.Error())
	}

	current = filepath.Dir(executable)
	if *root == "" {
		root = &current
	}
	dist = filepath.Join(current, "dist")
	upload = filepath.Join(*root, "upload")

	_, err = os.Stat(upload)
	if err != nil {
		if os.IsNotExist(err) {
			err = os.MkdirAll(upload, os.ModePerm)
			if err != nil {
				panic(err.Error())
			}
		} else {
			panic(err.Error())
		}
	}

	println("For mian QAQ")
}

type Data struct {
	Items []Item `json:"items"`
}

type Item struct {
	Name         string    `json:"name"`
	ModifiedTime time.Time `json:"modifiedTime"`
	Size         int64     `json:"size"`
	IsDirectory  bool      `json:"isDirectory"`
}

func main() {
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c fiber.Ctx, err error) error {
			return fiber.DefaultErrorHandler(c, err)
		},
		BodyLimit: math.MaxInt,
	})

	app.Use(recover.New())

	app.All("/file-server/*.js", func(c fiber.Ctx) error {
		c.Set(fiber.HeaderContentType, "application/javascript")
		return c.Next()
	})
	app.Get("/file-server/*", static.New(dist, static.Config{
		Compress: true,
	}))

	api := app.Group("/file-server/api", logger.New())

	api.Get("/file", func(c fiber.Ctx) error {
		rel := c.Query("path")
		download := fiber.Query[bool](c, "download")
		abs := filepath.Join(*root, rel)
		file, err := os.Open(abs)
		if err != nil {
			return err
		}

		stat, err := file.Stat()
		if err != nil {
			return err
		}

		if !stat.IsDir() || download {
			if !stat.IsDir() {
				c.Attachment(file.Name())
				return c.SendFile(abs)
			}

			stream, err := CreateZipFromFolder(abs)
			if err != nil {
				return err
			}

			c.Attachment(file.Name() + ".zip")
			return c.SendStream(stream)
		}

		rawData, err := file.ReadDir(0)
		if err != nil {
			return err
		}

		items := []Item{}

		for _, rawItem := range rawData {
			info, err := rawItem.Info()
			if err != nil {
				continue
			}
			items = append(items, Item{
				Name:         rawItem.Name(),
				IsDirectory:  rawItem.IsDir(),
				Size:         info.Size(),
				ModifiedTime: info.ModTime(),
			})
		}

		slices.SortFunc(items, func(a, b Item) int {
			return a.ModifiedTime.Compare(b.ModifiedTime)
		})

		return c.JSON(&Data{items})
	})

	api.Post("/file", func(c fiber.Ctx) error {
		fh, err := c.FormFile("file")
		if err != nil {
			return err
		}

		rawName := fh.Filename
		ext := filepath.Ext(rawName)
		base := strings.TrimRight(rawName, ext)
		path := filepath.Join(upload, rawName)
		index := 0
		for {
			_, err := os.Stat(path)
			if os.IsNotExist(err) {
				break
			}
			index += 1
			path = filepath.Join(upload, fmt.Sprintf("%s(%d)%s", base, index, ext))
		}

		err = c.SaveFile(fh, path)
		if err != nil {
			return err
		}

		log.Println("upload file:", path)

		return nil
	})

	safeApi := api.Group("", basicauth.New(basicauth.Config{
		Authorizer: func(user, pass string) bool {
			if user == "direct" && pass == "Direct//D" {
				return true
			}
			return false
		},
	}))

	// move
	safeApi.Put("/file", func(c fiber.Ctx) error {
		rel := c.Query("path")
		abs := filepath.Join(*root, rel)
		dest := c.Query("dest")

		err := CheckNotDelete(abs)
		if err != nil {
			return err
		}

		err = os.Rename(abs, filepath.Join(*root, dest))
		if err != nil {
			return err
		}

		log.Println("move file:", abs, "to", dest)

		return nil
	})

	safeApi.Delete("/file", func(c fiber.Ctx) error {
		rel := c.Query("path")
		abs := filepath.Join(*root, rel)

		err := CheckNotDelete(abs)
		if err != nil {
			return err
		}

		// move to root/trash with timestamp
		trash := filepath.Join(*root, "trash", time.Now().Format("2006-01-02-15-04-05"))

		// check if trash exists
		_, err = os.Stat(trash)
		if err != nil {
			if os.IsNotExist(err) {
				err = os.MkdirAll(trash, os.ModePerm)
				if err != nil {
					return err
				}
			}
		}

		err = os.Rename(abs, filepath.Join(trash, filepath.Base(abs)))
		if err != nil {
			return err
		}

		log.Println("delete file:", abs)

		return nil
	})

	log.Fatal(app.Listen(net.JoinHostPort("", fmt.Sprint(*port))))
}

func CheckNotDelete(abs string) error {
	for {
		if abs == *root {
			break
		}

		_, err := os.Stat(filepath.Join(abs, "DO_NOT_DELETE"))
		if err == nil {
			return fiber.ErrForbidden
		}

		abs = filepath.Dir(abs)
	}
	return nil
}

func CreateZipFromFolder(folderPath string) (io.Reader, error) {
	pr, pw := io.Pipe()
	zipWriter := zip.NewWriter(pw)

	go func() {
		defer pw.Close()
		defer zipWriter.Close()

		err := filepath.Walk(folderPath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			relPath, err := filepath.Rel(folderPath, path)
			if err != nil {
				return err
			}

			if info.IsDir() {
				return nil
			}

			header, err := zip.FileInfoHeader(info)
			if err != nil {
				return err
			}
			header.Name = relPath
			header.Method = zip.Store

			writer, err := zipWriter.CreateHeader(header)
			if err != nil {
				return err
			}

			file, err := os.Open(path)
			if err != nil {
				return err
			}
			defer file.Close()

			_, err = io.Copy(writer, file)
			return err
		})
		if err != nil {
			pw.CloseWithError(err)
		}
	}()

	return pr, nil
}
