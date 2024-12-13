package main

import (
	"archive/zip"
	"embed"
	"flag"
	"fmt"
	"io"
	"io/fs"
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
	current      = ""
	upload       = ""
	lastModified = time.Time{}
	root         = flag.String("root", "", "where the files are")
	port         = flag.Int("port", 8080, "listen to some port")
)

//go:embed file-server/*
var em embed.FS

func init() {
	flag.Parse()

	executable, err := os.Executable()
	if err != nil {
		panic(err.Error())
	}

	info, err := os.Stat(executable)
	if err != nil {
		panic(err.Error())
	}

	lastModified = info.ModTime()

	current = filepath.Dir(executable)
	if *root == "" {
		root = &current
	}
	*root = filepath.Clean(*root)
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

type staticFS struct {
	embed.FS
}

type staticFile struct {
	fs.File
}

type staticStat struct {
	fs.FileInfo
}

func (s staticFS) Open(name string) (fs.File, error) {
	f, err := s.FS.Open(name)
	if err != nil {
		return nil, err
	}
	return &staticFile{f}, nil
}

func (s *staticFile) Stat() (fs.FileInfo, error) {
	stat, err := s.File.Stat()
	if err != nil {
		return nil, err
	}
	return &staticStat{stat}, nil
}

func (s *staticFile) Seek(offset int64, whence int) (int64, error) {
	return s.File.(io.Seeker).Seek(offset, whence)
}

func (s *staticStat) ModTime() time.Time {
	return lastModified
}

func main() {
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c fiber.Ctx, err error) error {
			return fiber.DefaultErrorHandler(c, err)
		},
		BodyLimit: math.MaxInt,
	})

	app.Use(recover.New())

	api := app.Group("/file-server/api", logger.New())

	api.Get("/file", func(c fiber.Ctx) error {
		rel := c.Query("path")
		download := fiber.Query[bool](c, "download")
		abs := filepath.Join(*root, rel)
		err := CheckFileInRoot(abs)
		if err != nil {
			return err
		}

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

	api.All("/logout", func(c fiber.Ctx) error {
		return c.SendStatus(fiber.StatusUnauthorized)
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

		err := CheckFileInRoot(abs)
		if err != nil {
			return err
		}

		dest = filepath.Join(*root, dest)
		err = CheckFileInRoot(dest)
		if err != nil {
			return err
		}

		err = CheckNotDelete(abs)
		if err != nil {
			return err
		}

		err = os.Rename(abs, dest)
		if err != nil {
			return err
		}

		log.Println("move file:", abs, "to", dest)

		return nil
	})

	safeApi.Delete("/file", func(c fiber.Ctx) error {
		rel := c.Query("path")
		abs := filepath.Join(*root, rel)

		err := CheckFileInRoot(abs)
		if err != nil {
			return err
		}

		err = CheckNotDelete(abs)
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

	app.All("/file-server/*.js", func(c fiber.Ctx) error {
		c.Set(fiber.HeaderContentType, "application/javascript")
		return c.Next()
	})

	app.Get("/file-server/*", static.New("BAD", static.Config{
		FS:       staticFS{em},
		Compress: true,
	}))

	log.Fatal(app.Listen(net.JoinHostPort("", fmt.Sprint(*port))))
}

func CheckFileInRoot(abs string) error {
	if !strings.HasPrefix(filepath.Clean(abs), *root) {
		return fiber.ErrForbidden
	}
	return nil
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

		next := filepath.Dir(abs)
		if next == abs {
			break
		}

		abs = next
	}
	return nil
}

func CreateZipFromFolder(folderPath string) (io.Reader, error) {
	pr, pw := io.Pipe()
	zipWriter := zip.NewWriter(pw)

	go func() {
		defer pw.Close()
		defer zipWriter.Close()

		f := os.DirFS(folderPath)

		err := zipWriter.AddFS(f)
		if err != nil {
			pw.CloseWithError(err)
			return
		}
	}()

	return pr, nil
}
