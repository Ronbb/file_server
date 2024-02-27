package main

import (
	"cmp"
	"flag"
	"fmt"
	"log"
	"math"
	"net"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
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
	IsDir        bool      `json:"isDir"`
}

func main() {
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return fiber.DefaultErrorHandler(c, err)
		},
		BodyLimit: math.MaxInt,
	})

	app.Use(recover.New())

	app.All("/file-server/*.js", func(ctx *fiber.Ctx) error {
		ctx.Set(fiber.HeaderContentType, "application/javascript")
		return ctx.Next()
	})
	app.Static("/file-server", dist, fiber.Static{
		Compress: true,
	})

	api := app.Group("/file-server/api", logger.New())

	api.Get("/file", func(c *fiber.Ctx) error {
		rel := c.Query("path")
		abs := filepath.Join(*root, rel)
		file, err := os.Open(abs)
		if err != nil {
			return err
		}

		stat, err := file.Stat()
		if err != nil {
			return err
		}

		if !stat.IsDir() {
			c.Attachment(file.Name())
			return c.SendFile(abs)
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
				IsDir:        rawItem.IsDir(),
				ModifiedTime: info.ModTime(),
			})
		}

		slices.SortFunc(items, func(a, b Item) int {
			return -cmp.Compare(a.Name, b.Name)
		})

		return c.JSON(&Data{items})
	})

	api.Post("/upload", func(c *fiber.Ctx) error {
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

	log.Fatal(app.Listen(net.JoinHostPort("", fmt.Sprint(*port))))
}
