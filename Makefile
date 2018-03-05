NPM_PACKAGE := $(shell node -e 'process.stdout.write(require("./package.json").name)')
NPM_VERSION := $(shell node -e 'process.stdout.write(require("./package.json").version)')

TMP_PATH    := /tmp/${NPM_PACKAGE}-$(shell date +%s)

REMOTE_NAME ?= origin
REMOTE_REPO ?= $(shell git config --get remote.${REMOTE_NAME}.url)

CURR_HEAD   := $(firstword $(shell git show-ref --hash HEAD | cut -b -6) master)
GITHUB_PROJ := https://github.com//nodeca/${NPM_PACKAGE}


demo: lint
	rm -rf ./demo
	mkdir ./demo
	./node_modules/.bin/pug ./support/demo_template/index.pug --pretty \
		--out ./demo
	./node_modules/.bin/stylus -u autoprefixer-stylus \
		< ./support/demo_template/index.styl \
		> ./demo/index.css
	rm -rf ./support/demo_template/sample.json
	./node_modules/.bin/browserify ./ -s tabex > ./demo/tabex.js
	./node_modules/.bin/browserify ./support/demo_template/index.js > ./demo/index.js
	cp ./support/demo_template/README.md ./demo/


lint:
	./node_modules/.bin/eslint --reset .

test: lint browserify
	./node_modules/.bin/mocha-browser ./test/test.html --server

gh-pages: demo
	touch ./demo/.nojekyll
	cd ./demo \
		&& git init . \
		&& git add . \
		&& git commit -m "Auto-generate demo" \
		&& git remote add remote git@github.com:nodeca/tabex.git \
		&& git push --force remote +master:gh-pages
	rm -rf ./demo


publish:
	@if test 0 -ne `git status --porcelain | wc -l` ; then \
		echo "Unclean working tree. Commit or stash changes first." >&2 ; \
		exit 128 ; \
		fi
	@if test 0 -ne `git fetch ; git status | grep '^# Your branch' | wc -l` ; then \
		echo "Local/Remote history differs. Please push/pull changes." >&2 ; \
		exit 128 ; \
		fi
	@if test 0 -ne `git tag -l ${NPM_VERSION} | wc -l` ; then \
		echo "Tag ${NPM_VERSION} exists. Update package.json" >&2 ; \
		exit 128 ; \
		fi
	git tag ${NPM_VERSION} && git push origin ${NPM_VERSION}
	npm publish ${GITHUB_PROJ}/tarball/${NPM_VERSION}

browserify:
	rm -rf ./dist
	mkdir dist
	# Browserify
	( printf "/*! ${NPM_PACKAGE} ${NPM_VERSION} ${GITHUB_PROJ} @license MIT */" ; \
		./node_modules/.bin/browserify ./ -s tabex \
		) > dist/tabex.js
	# Minify
	./node_modules/.bin/uglifyjs dist/tabex.js -b beautify=false,ascii_only=true -c -m \
		--preamble "/*! ${NPM_PACKAGE} ${NPM_VERSION} ${GITHUB_PROJ} @license MIT */" \
		> dist/tabex.min.js

todo:
	grep 'TODO' -n -r ./lib 2>/dev/null || test true


.PHONY: publish lint test todo demo
.SILENT: help lint test todo demo
