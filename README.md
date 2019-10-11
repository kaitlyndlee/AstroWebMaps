# AstroWebMaps
OpenLayers 4.x for planetary mapping


This library provides a method to run Openlayers 4 with planetary mapping conversions. This library is used in PILOT (pilot.wr.usgs.gov) and Astropedia (astrogeology.usgs.gov/search). An example on how to run the code is under the test directory. A single and/or minified version of the library can be built using the Makefile. The good stuff resides on under the js directory. Quick description:

* js/openlayers - a version of openlayers https://openlayers.org/
* js/astrowebmaps - source code
* js/astrowebmaps-loader.js - function to load javascript files separately. . . helps for debugging
* js/Console - basic and crusty UI using OL and astrowebmaps . . . not necessary
* js/Helpers/AstroGeometry.js - functions to do planetary conversions. Should be mapping-layer agnostic (should). Most of the OL has been stripped out.
* js/Helpers/AstroLockout.js - utilty function to stop browser input
* js/Map/AstroMap.js - glue to talk to OL 4.  Loads map, controls and layers.
* js/Map/AstroVector.js - draw vectors and store coordinates
* js/Map/AstroBoundingBox.js - inherits from AstroVector.js. . . adds conversion calls and talks to form fields.
* js/Map/AstroPoi.js - draw points and store coordinates
* js/Controls - special OL map controls including a graticule, layerswitcher, and scaleline. OL 3 and 4 versions.
* js/uglifyjs - minify library. . requires nodejs
