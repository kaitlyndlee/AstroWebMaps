#
# Makefile for AstroWebMaps
#
#  - simplified from ant build.xml
#  - no java dependency, no jquery dependency
#  - to minify, must have nodejs installed (uses uglifyjs)
#  - only copies AstroWebMaps and Openlayers bits
#

# directories
SRCDIR = js/astrowebmaps
BUILDDIR = build
WEBDIR = web
PUBDIR = ../pilot/AstroWebMaps
# file names
SINGLEFILE = $(BUILDDIR)/js-singlefile/AstroWebMaps.js
UGLIFYFILE = $(BUILDDIR)/js-min/AstroWebMaps.js
# executables
UGLIFY = $(SRCDIR)/uglifyjs/UglifyJS-master/bin/uglifyjs

init:
	mkdir -p $(BUILDDIR)
	mkdir -p $(BUILDDIR)/js-singlefile
	mkdir -p $(BUILDDIR)/js-min

publish: uglify
	mkdir -p $(PUBDIR)/js
	cp -p $(UGLIFYFILE) $(PUBDIR)/js/
	cp -rp $(WEBDIR)/* $(PUBDIR)

combine: init
	rm -f $(SINGLEFILE)
	cat $(SRCDIR)/Map/AstroMap.js \
	$(SRCDIR)/Console/AstroConsole.js \
	$(SRCDIR)/Map/AstroVector.js \
	$(SRCDIR)/Map/AstroBoundingBox.js \
	$(SRCDIR)/Map/AstroPoi.js \
	$(SRCDIR)/Map/Control/AstroControls.js \
	$(SRCDIR)/Helpers/AstroGeometry.js \
	$(SRCDIR)/Map/Control/ol4-scalelinecontrol.js > $(SINGLEFILE)
#	$(SRCDIR)/Map/Control/ol4-layerswitcher.js 

uglify: combine
	$(UGLIFY) $(SINGLEFILE) > $(UGLIFYFILE)