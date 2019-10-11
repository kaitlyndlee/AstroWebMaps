/*
 * Map/AstroMap.js
 *
 * This class wraps an OpenLayers map with Astro-specific functionality.
 *
 * Dependencies: OpenLayers.js, AstroGeometry.js, AstroVector.js, AstroBoundingBox.js, AstroControls.js
 */

/*
 * Constructor: Initializes map.
 *
 * Parameters: mapSettings         - hash of map initialization settings. If null, uses sensible defaults
 *             controlSettings     - hash of map control settings. If null, uses sensible defaults
 *             consoleSettings     - hash of console settings. If null, uses sensible defaults
 *             boundingBoxSettings - hash of bounding box settings. If null, uses sensible defaults
 *
 * Please refer to AstroControls.js, AstroConsole.js, and AstroBoundingBox.js for details on valid options
 * that can be passed in.
 *
 * The following map options may be set:
 *   mapDiv                       - the id (string) of the div to hold the OL map. Default: 'map'
 *   target                       - the target name. Default: 'mars'
 *   projection                   - the default map projection (string). Choices: 'cylindrical', 'north-polar stereographic',
 *                                  'south-polar stereographic'. Default: 'cylindrical'
 *   vectorLayerName              - the name for the vector feature layer to appear in the layer switcher. Default: 'Vectors'
 *   showNomenclature             - boolean indicating whether or not to load nomenclature layer (if available). Default: false
 *   datelineWrap                 - boolean indicating whether or not to wrap the map at the dateline. Default: true
 *   defaultZoomLevel             - number for default zoom level. Default: 3
 *   defaultCenterLat             - default center latitude of the map. Default: 0
 *   defaultCenterLon             - default center longitude of the map. Default: 180
 *   projectionSwitchTrigger      - callback function for map projection switches. Default: empty function
 *   imagePath                    - path to the images directory, be sure to include the trailing slash. Required.
 */


function AstroMap(mapSettings, controlSettings, consoleSettings, boundingBoxSettings) {
  // instance variables
  this.map = null;  // OL map object
  this.mapSettings = mapSettings;
  this.controlSettings = controlSettings;
  this.consoleSettings = consoleSettings;
  this.boundingBoxSettings = boundingBoxSettings;

  this.imagePath = null;

  this.controls = null;
  this.console = null;
  this.baseLayerGroup = null;
  this.overLayerGroup = null;
  this.mapOverlay = null;

  this.boundingBoxSource = null;
  this.boundingBoxLayer = null;
  this.boundingBoxDrawer = null;

  this.vectorSource = null;
  this.vectorLayer = null;

  this.poiSource = null;
  this.poiLayer = null;

  this.imageSource = null;
  this.imageLayer = null;

  this.dummyLayer = null;

  this.homeLonLat = null;
  this.mapsLoaded = false;
  this.hasNorthPolar = false;
  this.hasSouthPolar = false;
  this.nomenWFSURL = null;
  this.longitudeDirection = 'PositiveEast';
  this.longitudeDomain = '360';
  this.latitudeType = 'Planetocentric';
  this.displayProjection = "EPSG:4326";  // controls (eg. mouse position) should display in normal lat/lon projection
  this.fullBoundingBox = null;

  // radii of the current target (used in projection calculations)
  this.aAxisRadius = 0;
  this.bAxisRadius = 0;
  this.cAxisRadius = 0;

  // map default settings
  this.mapDiv = "map";  // div id to hold map
  this.target = "mars";
  this.projection = "cylindrical";
  this.currentProj = 'EPSG:4326';
  this.vectorLayerName = "Vectors";
  this.showNomenclature = false;
  this.datelineWrap = true;
  this.deepZoom = false;
  this.defaultZoomLevel = 3;
  this.defaultCenterLat = 0;
  this.defaultCenterLon = 180;

  // event callbacks
  this.projectionSwitchTrigger = function() {};

  // initialize everything
  this.init();
}


//
AstroMap.prototype.destroy = function() {
  this.controls.deactivateButtons();
  this.controls = null;  // destroy controls
  this.map.setTarget(null);
  this.map = null;
};

//
AstroMap.prototype.home = function() {
  if (this.homeLonLat) {
    var view = this.map.getView();
    view.setCenter(this.homeLonLat);
  }
};

/*
 * Initializes a new map and its associated components. This is essentially a
 * helper method that does the 'heavy lifting' for the AstroMap constructor.
 * This method can also come in handy when needing to recreate the map for a
 * new projection.
 *
 * Parameters: none
 * Returns: nothing
 */
AstroMap.prototype.init = function() {
  // set map properties or leave as default
  if (this.mapSettings) {
    if (this.mapSettings.mapDiv) {
      this.mapDiv = this.mapSettings.mapDiv;
    }
    if (this.mapSettings.target) {
      this.target = this.mapSettings.target.toLowerCase();
    }
    if (this.mapSettings.projection) {
      this.projection = this.mapSettings.projection;
    }
    if (this.mapSettings.vectorLayerName) {
      this.vectorLayerName = this.mapSettings.vectorLayerName;
    }
    if (this.mapSettings.showNomenclature) {
      this.showNomenclature = true;
    }
    if (!this.mapSettings.datelineWrap) {
      this.datelineWrap = false;
    }
    this.deepZoom = (!this.mapSettings.deepZoom || (this.mapSettings.deepZoom == 'false')) ? false : true;
    if (this.mapSettings.defaultZoomLevel) {
      this.defaultZoomLevel = this.mapSettings.defaultZoomLevel;
    }
    if (this.mapSettings.defaultCenterLat) {
      this.defaultCenterLat = this.mapSettings.defaultCenterLat;
    }
    if (this.mapSettings.defaultCenterLon) {
      this.defaultCenterLon = this.mapSettings.defaultCenterLon;
    }
    if (this.mapSettings.projectionSwitchTrigger) {
      this.projectionSwitchTrigger = this.mapSettings.projectionSwitchTrigger;
    }
    if (this.mapSettings.imagePath) {
      this.imagePath = this.mapSettings.imagePath;
    }
  }

  // load WMS layers or a dummy layer if that fails
  this.mapsLoaded = this.loadLayers(this.target, this.projection, this.showNomenclature, this.datelineWrap);
  var numMaps = this.mapsLoaded[0].getLayers().getLength();
  if (numMaps == 0) {
    this.mapsLoaded = this.loadDummyLayer();
  }

  // center map and set zoom
  var currentZoom = (this.projection == 'cylindrical') ? this.defaultZoomLevel : 3;

  var caxis = this.cAxisRadius;

  //Polar Projections
  var currentCaxis = 0;
  var northPolarProjection = new ol.proj.Projection({
      code: 'EPSG:32661',
      extent: [-2357032, -2357032, 2357032, 2357032],
      worldExtent: [0, 60, 360, 90],
      units: 'm'
  });
  ol.proj.addProjection(northPolarProjection);

  ol.proj.addCoordinateTransforms('EPSG:32661', northPolarProjection,
				  function(coordinate) {
				       return AstroGeometry.transformLatLonToPolarMeters(coordinate, 'north-polar stereographic', caxis);
				     },
				     function(coordinate) {
				       return AstroGeometry.transformPolarMetersToLatLon(coordinate, 'north-polar stereographic', caxis);
				     });
  ol.proj.addCoordinateTransforms('EPSG:4326', 'EPSG:32661',
				     function(coordinate) {
				       return AstroGeometry.transformLatLonToPolarMeters(coordinate, 'north-polar stereographic', caxis);
					 },
				  function(coordinate) {
				       return AstroGeometry.transformPolarMetersToLatLon(coordinate, 'north-polar stereographic', caxis);
				     });

  var southPolarProjection = new ol.proj.Projection({
      code: 'EPSG:32761',
      extent: [-2357032, -2357032, 2357032, 2357032],
      worldExtent: [0, -90, 360, -60],
      units: 'm'
  });
  ol.proj.addProjection(southPolarProjection);
  ol.proj.addCoordinateTransforms('EPSG:32761', southPolarProjection,
				  function(coordinate) {
				       return AstroGeometry.transformLatLonToPolarMeters(coordinate, 'south-polar stereographic', caxis);
				     },
				     function(coordinate) {
				       return AstroGeometry.transformPolarMetersToLatLon(coordinate, 'south-polar stereographic', caxis);
				     });
  ol.proj.addCoordinateTransforms('EPSG:4326', 'EPSG:32761',
				     function(coordinate) {
				       return AstroGeometry.transformLatLonToPolarMeters(coordinate, 'south-polar stereographic', caxis);
				     },
				  function(coordinate) {
				       return AstroGeometry.transformPolarMetersToLatLon(coordinate, 'south-polar stereographic', caxis);
				     });


  // secondary projections
  var undangleProjection = new ol.proj.Projection({
      code: 'undangle',
      units: 'degrees'
  });
  ol.proj.addProjection(undangleProjection);
  ol.proj.addCoordinateTransforms('EPSG:4326', 'undangle',
				  function(coordinate) {
				    return AstroGeometry.transformDanglers(coordinate);
				  },
				  function(coordinate) {
				    return AstroGeometry.transformDanglers(coordinate);
				  });
  var truncateProjection = new ol.proj.Projection({
      code: 'truncate',
      units: 'degrees'
  });
  ol.proj.addProjection(truncateProjection);
  ol.proj.addCoordinateTransforms('EPSG:4326', 'truncate',
				  function(coordinate) {
				    return AstroGeometry.transformTruncate(coordinate);
				  },
				  function(coordinate) {
				    return AstroGeometry.transformTruncate(coordinate);
				  });


  //set projection
  if (this.projection == 'cylindrical') {
    this.currentProj = 'EPSG:4326';
  } else if (this.projection == 'north-polar stereographic') {
    this.currentProj = northPolarProjection;
  } else {
    this.currentProj = southPolarProjection;
  }


  //pop-up overlay
  mapPopup = document.getElementById('mapPopup');
  var overlayPopup = new ol.Overlay(({
    element: mapPopup,
    autoPan: true,
    autoPanAnimation: {
      duration: 250
    }
  }));
  this.mapOverlay = overlayPopup;


  view = new ol.View({
     zoom: currentZoom,
     center:[180,0],
     projection: this.currentProj,
     minZoom:2,
     maxZoom:10
  });

  var options = {
    controls: [],
    target:"map",
    view:view,
    overlays: [overlayPopup],
    layers: this.mapsLoaded
  };

  this.map = new ol.Map(options);

  if (this.console == null && (this.consoleSettings != null)) {
    this.console = new AstroConsole(this, this.consoleSettings);
  }
  if (this.console){
    this.console.toggleProjection(this.projection);
  }

  this.boundingBoxSource = new ol.source.Vector();
  this.boundingBoxLayer = new ol.layer.Vector({
			     source: this.boundingBoxSource,
			     style: new ol.style.Style({
			       fill: new ol.style.Fill({
				 color: 'rgba(255, 0, 0, 0.2)'
			       }),
			       stroke: new ol.style.Stroke({
				 color: '#ff0000',
				 width: 2
			       }),
			       image: new ol.style.Circle({
				 radius: 7,
				 fill: new ol.style.Fill({
				   color: '#ffcc33'
				 })
			       })
			     })
  });
  this.map.addLayer(this.boundingBoxLayer);
  if (this.boundingBoxDrawer == null) {
    this.boundingBoxDrawer = new AstroBoundingBox(this, this.boundingBoxSource, this.boundingBoxSettings);
  } else if (this.boundingBoxDrawer.updateLayer) {
    this.boundingBoxDrawer.updateLayer(this.boundingBoxSource);
  }

  //vector layer
  this.vectorSource = new ol.source.Vector({
    wrapX: false //unset for pixel tests
  });
  this.vectorLayer = new ol.layer.Vector({
		       source: this.vectorSource,
		       extent: [0,-90, 360, 90],
		       style: new ol.style.Style({
			 fill: new ol.style.Fill({
			   color: 'rgba(255, 0, 0, 0.2)'
			 }),
			 stroke: new ol.style.Stroke({
			   color: '#ff0000',
			   width: 2
			 }),
			 image: new ol.style.Circle({
			   radius: 7,
			   fill: new ol.style.Fill({
			     color: '#ffcc33'
			   })
			 })
		       })
  });
  this.vectorLayer.set('selectable',true);
  this.map.addLayer(this.vectorLayer);

  //poi layer
  this.poiSource = new ol.source.Vector({
    wrapX: false
  });
  this.poiLayer = new ol.layer.Vector({
		       source: this.poiSource,
		       style: new ol.style.Style({
			 fill: new ol.style.Fill({
			   color: 'rgba(255, 0, 0, 0.2)'
			 }),
			 stroke: new ol.style.Stroke({
			   color: '#ff0000',
			   width: 2
			 }),
			 image: new ol.style.Circle({
			   radius: 7,
			   fill: new ol.style.Fill({
			     color: '#ffcc33'
			   })
			 })
		       })
  });
  this.poiLayer.set('selectable',true);
  this.map.addLayer(this.poiLayer);

  //image layer
  imageTitle = 'Footprint Images';
  this.imageSource = null;
  this.imageLayer = new ol.layer.Image({
					 title: imageTitle
					 });
  if (this.overLayerGroup) {
    this.overLayerGroup.getLayers().push(this.imageLayer);
  }

  //controls
  if (this.controls == null) {
    this.controls = new AstroControls(this, this.controlSettings);
  }

};

//
AstroMap.prototype.loadImage = function(url, extent) {

  imageTitle = 'Footprint Images';
  this.imageSource = new ol.source.ImageStatic({
    attributions: [
      new ol.Attribution({
	html: ''
			 })
    ],
    url: url,
    projection: this.projection,
    imageExtent: extent
    });
  this.imageLayer.setSource(this.imageSource);

};


//
//
AstroMap.prototype.setImageOpacity = function(val) {
  this.imageLayer.setOpacity(val);
};


/*
 * Loads the map layers for the given target and projection and adds them to the map.
 * The JSON map layers should be imported before this method is called.
 *
 * Parameters: target           - lowercased target string (e.g. 'mars')
 *             mapProjection    - map projection string (e.g. 'cylindrical')
 *             showNomenclature - boolean for whether or not to include nomenclature layers
 *             datelineWrap     - boolean for whether or not the layer should wrap at the dateline
 * Returns: true if layer(s) were loaded, false if none were loaded
 */
AstroMap.prototype.loadLayers = function(target, mapProjection, showNomenclature, datelineWrap) {
  var loadSuccess = false;
  this.hasNorthPolar = false;
  this.hasSouthPolar = false;
  baseLayers= [];
  overLayers=[];

  // find the correct target first, and then load the appropriate layers
  var targets = myJSONmaps['targets'];
  for (var i = 0, len = targets.length; i < len; i++) {
    var currentTarget = targets[i];
    if (currentTarget['name'].toLowerCase() == target) {
      // set the default dd length (in inches) to match the current target, not earth
      var equatorialRadius = currentTarget['aaxisradius'];
      var equatorLength = (2 * Math.PI * equatorialRadius * 39370.0787);
      //ol.INCHES_PER_UNIT.dd = (equatorLength / 360.0);

      this.aAxisRadius = currentTarget['aaxisradius'];
      this.bAxisRadius = currentTarget['baxisradius'];
      this.cAxisRadius = currentTarget['caxisradius'];

      var jsonLayers = currentTarget['webmap'];
      for (var j = 0, innerLen = jsonLayers.length; j < innerLen; j++) {
        var currentLayer = jsonLayers[j];
	switch(currentLayer['type']) {
          case 'WMS':
            if (currentLayer['projection'] == 'north-polar stereographic') {
              this.hasNorthPolar = true;
            }
            else if (currentLayer['projection'] == 'south-polar stereographic') {
              this.hasSouthPolar = true;
            }

            // if the layer matches, add it to the map
            if (currentLayer['projection'] == mapProjection) {
              var wrapCheck = datelineWrap;
              var computedMaxResolution = (360 / 256);
              var computedNumZoomLevels = 11;
              var extent = [currentLayer['bounds']['left'],currentLayer['bounds']['bottom'],currentLayer['bounds']['right'],currentLayer['bounds']['top']];

              if (currentLayer['units'] =='m') {
                wrapCheck = false;
                computedMaxResolution = 20000;
                computedNumZoomLevels = 8;
                boundsExtent = extent;
              }
	      var extraZoom = (this.deepZoom) ? 2 : 0;
              var baseLayerCheck = (currentLayer['transparent'] == 'false') ? true : false;
              var visibilityCheck =((currentLayer['layer'] == 'NOMENCLATURE') && (showNomenclature)) ? true : false;
              var singleTileCheck  = (currentLayer['layer'] == 'NOMENCLATURE') ? true : false;

              // Set up attribution (note at bottom of map).
              var attributionValue = '';
              attributionValue += (currentLayer['citation'].length > 0) ? ' ' + currentLayer['citation'] : '';
              attributionValue += (currentLayer['notes'].length > 0) ?  ' ' + currentLayer['notes'] : '';

       if (baseLayerCheck) {
	 isPrimary = (currentLayer['primary'] == 'true');
	 baseLayers.push(new ol.layer.Tile({
				title: currentLayer['displayname'],
				type: 'base',
				visible: isPrimary,
				maxResolution: computedMaxResolution,
				source: new ol.source.TileWMS({
					url: currentLayer['url'] + '?map=' + currentLayer['map'],
					params:{ 'LAYERS':currentLayer['layer']},
					serverType: 'mapserver',
					crossOrigin: 'anonymous',
					wrapX: wrapCheck
				})
	   }));
	 } else {
	   overLayers.push(new ol.layer.Tile({
				title: currentLayer['displayname'],
				visible: false,
				maxResolution: computedMaxResolution,
				enableOpacitySliders: true,
				source: new ol.source.TileWMS({
					url: currentLayer['url'] + '?map=' + currentLayer['map'],
					params:{ 'LAYERS':currentLayer['layer'], 'TILED':true },
					crossOrigin: 'anonymous',
					wrapX: wrapCheck
		       })
	     }));
	 }

            } // if projection matches
            break;
          case 'WFS':
            this.nomenWFSURL = currentLayer['url'];
            break;
        }
      } // for each layer
    }
  } // for each target

  group1 = new ol.layer.Group({'title': 'Base maps', layers: baseLayers});
  this.baseLayerGroup = group1;
  if (overLayers.length > 0) {
    group2 = new ol.layer.Group({'title': 'Overlays', layers: overLayers});
    this.overLayerGroup = group2;
    return [group1, group2];
  } else {
    return [group1];
  }

};

//
AstroMap.prototype.loadDummyLayer = function() {
  var dummyURL ="http://planetarymaps.usgs.gov/cgi-bin/mapserv";
  var dummyMap = "/maps/generic/generic_simp_cyl.map";
  var dummyLayer = "MINECRAFT";
  //var dummyLayer = "OLD";
  var extent = [0, -90, 360, 90];
  var computedMaxResolution = (360 / 256);
  var baseLayers = [];
  baseLayers.push(new ol.layer.Tile({
    title: "NO IMAGE AVAILABLE",
    type: 'base',
    visible: true,
    maxResolution: computedMaxResolution,
    source: new ol.source.TileWMS({
      url: dummyURL + '?map=' + dummyMap,
      params:{ 'LAYERS': dummyLayer},
      serverType: 'mapserver',
      wrapX: true
	})
      }));
  group1 = new ol.layer.Group({'title': 'Base map', layers: baseLayers});
  return [group1];
};

//
AstroMap.prototype.switchProjection = function(newProjection) {
  if ((newProjection == 'north-polar stereographic') && (!this.hasNorthPolar)) {
    alert('North Polar image is NOT AVAILABLE');
    return;
  }
  if ((newProjection == 'south-polar stereographic') && (!this.hasSouthPolar)) {
    alert('South Polar image is NOT AVAILABLE');
    return;
  }
  this.destroy();
  this.mapSettings.projection = newProjection;
  this.init();

  // event callback
  this.projectionSwitchTrigger();
};


/*
 * Pans to the homeLonLat and zooms to the specified level.
 *
 * Parameter: zoomLevel - the zoom level
 * Returns: nothing
 */
AstroMap.prototype.zoom = function(zoomLevel) {
  if (this.homeLonLat) {
    this.map.moveTo(this.homeLonLat, zoomLevel);
  } else {
    astroMap.map.zoomTo(zoomLevel);
  }
};

/*
 * Console/AstroConsole.js
 *
 * Class to drive console.
 *
 * Dependencies: AstroMap.js
 */

//over-ridable callbacks
// TODO
function astroConsoleHistoryPrev() {};
function astroConsoleHistoryNext() {};

/*
 * Constructor creates the console elements and puts them on the page.
 *
 * Parameters: astroMap        - reference to map that this console is attached to
 *             consoleSettings - hash of options, if null uses sensible defaults
 *
 * The following options may be set:
 *   target           - the target string. Default: 'Mars'
 *   projButtons      - boolean indicating whether or not to display projection buttons. Default: false
 *   lonLatSelects    - boolean indicating whether or not to display lon/lat dropdowns. Default: false
 *   mouseLonLat      - boolean indicating whether or not to display mouse lon/lats. Default: false
 *   targetInfoDiv    - string for target info div id. This element should already exist on the page. Default: 'astroConsoleTargetInfo'
 *   projButtonsDiv   - string for projection buttons div id. This element should already exist on the page. Default: 'astroConsoleProjectionButtons'
 *   lonLatSelectsDiv - string for lon/lat selects div id. This element should already exist on the page. Default: 'astroConsoleLonLatSelects'
 *   keyDiv           - string for keys div id (the legend). This element should already exist on the page. Default: 'astroConsoleKey'
 */
function AstroConsole(astroMap, consoleSettings) {
  // instance variables
  this.astroMap = astroMap;
  this.target = 'Mars';
  this.targetInfo = false;
  this.projButtons = false;
  this.lonLatSelects = false;
  this.mouseLonLat = false;
  this.featureFinder = false;

  // key colors
  this.keyColors = ["blue", "green", "purple", "aqua", "lime", "olive", "teal"];
  this.key = new Array();

  // image path
  this.imagePath = this.astroMap.imagePath;

  // console divs
  this.targetInfoDiv = "astroConsoleTargetInfo";
  this.projButtonsDiv = "astroConsoleProjectionButtons";
  this.lonLatSelectsDiv = "astroConsoleLonLatSelects";
  this.keyDiv = "astroConsoleKey";
  this.featureFinderDiv = "astroFeatureFinder";

  //element ids . . . only one per page
  this.targetImgId = "astroConsoleTargetImage";
  this.northPoleImgId = "astroProjectionNorthPole";
  this.cylindricalImgId = "astroProjectionCylindrical";
  this.southPoleImgId = "astroProjectionSouthPole";
  this.lonDirSelectId = "astroConsoleLonDirSelect";
  this.lonDomSelectId = "astroConsoleLonDomSelect";
  this.latTypeSelectId = "astroConsoleLatTypeSelect";
  this.mouseLonLatDiv = "astroConsoleLonLat";
  this.featureTypeSelectId = "astroFeatureType";
  this.featureNameSelectId = "astroFeatureName";

  // set up console according to supplied settings
  if (consoleSettings) {
    if (consoleSettings.target) {
      this.target = consoleSettings.target;
    }
    if (consoleSettings.targetInfo) {
      this.targetInfo = true;
    }
    if (consoleSettings.projButtons) {
      this.projButtons = true;
    }
    if (consoleSettings.lonLatSelects) {
      this.lonLatSelects = true;
    }
    if (consoleSettings.featureFinder) {
      this.featureFinder = true;
    }
    if (consoleSettings.mouseLonLat) {
      this.mouseLonLat = true;
    }
    if (consoleSettings.targetInfoDiv) {
      this.targetInfoDiv = consoleSettings.targetInfoDiv;
    }
    if (consoleSettings.projButtonsDiv) {
      this.projButtonsDiv = consoleSettings.projButtonsDiv;
    }
    if (consoleSettings.lonLatSelectsDiv) {
      this.lonLatSelectsDiv = consoleSettings.lonLatSelectsDiv;
    }
    if (consoleSettings.keyDiv) {
      this.keyDiv = consoleSettings.keyDiv;
    }
    if (consoleSettings.featureFinderDiv) {
      this.featureFinderDiv = consoleSettings.featureFinderDiv;
    }
  }

  // create console UI elements
  if (this.targetInfo) {
    this.targetInfoSetup();
  }
  if (this.mouseLonLat) {
    this.mouseLonLatSetup();
  }
  if (this.projButtons) {
    this.projButtonsSetup();
  }
  if (this.lonLatSelects) {
    this.lonLatSelectsSetup(null, null);
  }
  if (this.featureFinder) {
    this.featureFinderSetup();
  }
};

/*
 * Creates the target info elements.
 */
AstroConsole.prototype.targetInfoSetup = function() {
  var container = document.getElementById(this.targetInfoDiv);

  var targetImg = document.createElement("img");
  targetImg.setAttribute('id', this.targetImgId);
  targetImg.setAttribute('alt', this.target);
  targetImg.setAttribute('title', this.target);
  targetImg.setAttribute('src', this.imagePath + this.target.toLowerCase() + ".png");
  targetImg.className ='astroConsoleTargetImg';
  container.appendChild(targetImg);

  var targetSpan = document.createElement("span");
  targetSpan.className ='astroConsoleTargetName';
  targetSpan.innerHTML = this.target + '<br/>';
  container.appendChild(targetSpan);
};

/*
 * Creates the lon/lat display for the current mouse position
 * and adds it to target info div.
 */
AstroConsole.prototype.mouseLonLatSetup = function() {
  var container = document.getElementById(this.targetInfoDiv);

  var lonLatTitle = document.createElement("div");
  lonLatTitle.className ='astroConsoleLonLatTitle';
  lonLatTitle.innerHTML = 'Lat Lon: &nbsp;';
  container.appendChild(lonLatTitle);

  var lonLatDiv = document.createElement("div");
  lonLatDiv.setAttribute('id', this.mouseLonLatDiv);
  lonLatDiv.className = 'astroConsoleLonLat';
  container.appendChild(lonLatDiv);
};


/*
 * Requires JQuery
 */
AstroConsole.prototype.featureFinderSetup = function() {
  var ftE = document.getElementById(this.featureFinderDiv);
  var ftSelect = document.createElement("select");
  ftSelect.setAttribute("id", this.featureTypeSelectId);
  ftSelect.className = "astroConsoleSelect";
  var ftOption = document.createElement("option");
  ftOption.text = "Select Type. . .";
  ftOption.value = "t";
  ftSelect.appendChild(ftOption);
  ftE.appendChild(ftSelect);

  var fnE = document.getElementById(this.featureFinderDiv);
  var fnSelect = document.createElement("select");
  fnSelect.setAttribute("id", this.featureNameSelectId);
  fnSelect.className = "astroConsoleSelect";
  fnSelect.disabled = true;
  var fnOption = document.createElement("option");
  fnOption.text = "Select Name. . .";
  fnOption.value = "t";
  fnSelect.appendChild(fnOption);
  fnE.appendChild(fnSelect);

};

//
AstroConsole.prototype.featureFinderLoadTypes = function(target) {

  $.ajax({
	   url: this.upcAjaxURLNoParams,
	   dataType: 'json',
	   data: 'act=featureTypesAjaxGet&target=' + target,
	   type: 'POST',
	   success: function(json) {

	     if (!json) {

	               } else {

			 var e = document.getElementById('upcFeatureType');
			 e.options.length = 0;
			 var newOption=document.createElement("option");
			 newOption.innerHTML= 'Select Type. . .';
			 e.appendChild(newOption);
			 var ft =  json['featureTypes']['type'];
			 for (var type in json['featureTypes']['type']) {

			   newOption=document.createElement("option");
			   newOption.text = ft[type];
			   newOption.innerHTML= ft[type];
			   newOption.setAttribute('value',ft[type]);
			   e.appendChild(newOption);
			             }
			         }
	             }
	 });
};

/*
 * Creates the projection switch buttons.
 */
AstroConsole.prototype.projButtonsSetup = function() {
  var container = document.getElementById(this.projButtonsDiv);

  // north pole
  var northPoleImg = document.createElement("img");
  northPoleImg.setAttribute('id',this.northPoleImgId);
  northPoleImg.setAttribute('alt','North Polar Stereographic');
  northPoleImg.setAttribute('title','North Polar Stereographic');
  northPoleImg.setAttribute('src',this.imagePath + "north-pole.png");
  northPoleImg.className ='astroConsoleProjectionButton';
  var that = this;
  northPoleImg.addEventListener("click", function() {that.astroMap.switchProjection('north-polar stereographic');});

  container.appendChild(northPoleImg);

  // cylindrical
  var cylindricalImg = document.createElement("img");
  cylindricalImg.setAttribute('id', this.cylindricalImgId);
  cylindricalImg.setAttribute('alt','Simple Cylindrical');
  cylindricalImg.setAttribute('title','Simple Cylindrical');
  cylindricalImg.setAttribute('src',this.imagePath + "cylindrical.png");
  cylindricalImg.className ='astroConsoleProjectionButton';
  cylindricalImg.addEventListener("click", function() {that.astroMap.switchProjection('cylindrical');});
  container.appendChild(cylindricalImg);

  // south pole
  var southPoleImg = document.createElement("img");
  southPoleImg.setAttribute('id', this.southPoleImgId);
  southPoleImg.setAttribute('alt','South Polar Stereographic');
  southPoleImg.setAttribute('title','South Polar Stereographic');
  southPoleImg.setAttribute('src',this.imagePath + "south-pole.png");
  southPoleImg.className ='astroConsoleProjectionButton';
  southPoleImg.addEventListener("click", function() {that.astroMap.switchProjection('south-polar stereographic');});

  container.appendChild(southPoleImg);
};

/*
 * Activates the projection button (changes the images) for the passed in projection.
 *
 * Parameter: clickedProjection - the projection string
 * Returns: nothing
 */
AstroConsole.prototype.toggleProjection = function(clickedProjection) {
  switch(clickedProjection) {
    case 'cylindrical':
      document.getElementById(this.cylindricalImgId).src = this.imagePath + "cylindrical-hot.png";
      document.getElementById(this.northPoleImgId).src = this.imagePath + "north-pole.png";
      document.getElementById(this.southPoleImgId).src = this.imagePath + "south-pole.png";
      break;
    case 'north-polar stereographic':
      document.getElementById(this.cylindricalImgId).src = this.imagePath + "cylindrical.png";
      document.getElementById(this.northPoleImgId).src = this.imagePath + "north-pole-hot.png";
      document.getElementById(this.southPoleImgId).src = this.imagePath + "south-pole.png";
      break;
    case 'south-polar stereographic':
      document.getElementById(this.cylindricalImgId).src = this.imagePath + "cylindrical.png";
      document.getElementById(this.northPoleImgId).src = this.imagePath + "north-pole.png";
      document.getElementById(this.southPoleImgId).src = this.imagePath + "south-pole-hot.png";
      break;
  }
};

/*
 * Creates the lon/lat dropdown boxes.
 *
 * Parameters: lonDir - the default longitude direction string ('PositiveWest' or 'PositiveEast')
 *             lonDom - the default longitude domain string (360 or 180)
 * Returns: nothing
 */
AstroConsole.prototype.lonLatSelectsSetup = function(lonDir, lonDom) {
  // get the div that will hold the dropdowns
  var container = document.getElementById(this.lonLatSelectsDiv);

  // create the dropdowns, populating them with options

  // Lon Dir dropdown
  var lonDirSelect = document.createElement("select");
  lonDirSelect.setAttribute("id", this.lonDirSelectId);
  lonDirSelect.className = "astroConsoleSelect";
  // create options
  var selected = (lonDir == 'PositiveWest') ? 'SELECTED' : '';
  var lonDirOption1 = document.createElement("option");
  lonDirOption1.text = "Positive East";
  lonDirOption1.value = "PositiveEast";
  var lonDirOption2 = document.createElement("option");
  lonDirOption2.text = "Positive West";
  lonDirOption2.value = "PositiveWest" + selected;

  // add the options to the select element
  try {
    // works for standards-compliant browsers (non-IE)
    lonDirSelect.add(lonDirOption1, null);
    lonDirSelect.add(lonDirOption2, null);
  } catch (e) {
    // needed for the wonderful IE
    lonDirSelect.add(lonDirOption1);
    lonDirSelect.add(lonDirOption2);
  }

  // wrap dropdown in its own div
  var lonDirSelectDiv = document.createElement("div");
  lonDirSelectDiv.appendChild(lonDirSelect);

  // add dropdown to container div
  container.appendChild(lonDirSelectDiv);

  // Lon Domain dropdown
  var lonDomSelect = document.createElement("select");
  lonDomSelect.setAttribute("id", this.lonDomSelectId);
  lonDomSelect.className = "astroConsoleSelect";
  selected = (lonDom == 360) ? 'SELECTED' : '';
  var lonDomOption1 = document.createElement("option");

  // unicode escapes needed because text is interpretted literally (can't use HTML entities),
  // and IE doesn't accept innerHTML on options
  lonDomOption1.text = "0\u00B0 to 360\u00B0";
  lonDomOption1.value = "360";
  var lonDomOption2 = document.createElement("option");
  lonDomOption2.text = "-180\u00B0 to 180\u00B0\u00A0";
  lonDomOption2.value = "180" + selected;

  try {
    lonDomSelect.add(lonDomOption1, null);
    lonDomSelect.add(lonDomOption2, null);
  } catch (e) {
    lonDomSelect.add(lonDomOption1);
    lonDomSelect.add(lonDomOption2);
  }

  var lonDomSelectDiv = document.createElement("div");
  lonDomSelectDiv.appendChild(lonDomSelect);
  container.appendChild(lonDomSelectDiv);

  // Lat Type dropdown
  var latTypeSelect = document.createElement("select");
  latTypeSelect.setAttribute("id", this.latTypeSelectId);
  latTypeSelect.className = "astroConsoleSelect";
  var latTypeOption1 = document.createElement("option");
  latTypeOption1.text = "Planetocentric";
  latTypeOption1.value = "Planetocentric";
  var latTypeOption2 = document.createElement("option");
  latTypeOption2.text = "Planetographic";
  latTypeOption2.value = "Planetographic";

  try {
    latTypeSelect.add(latTypeOption1, null);
    latTypeSelect.add(latTypeOption2, null);
  } catch (e) {
    latTypeSelect.add(latTypeOption1);
    latTypeSelect.add(latTypeOption2);
  }

  var latTypeSelectDiv = document.createElement("div");
  latTypeSelectDiv.appendChild(latTypeSelect);
  container.appendChild(latTypeSelectDiv);
};

/*
 * Adds a key to the console's legend.
 *
 * Parameters: name  - the key's label
 *             color - the color of the key
 * Returns: nothing
 */
AstroConsole.prototype.addKey = function(name, color) {
  this.key.push(name);
  var currentColor = (color == null) ? this.keyColors[this.key.length -1] : color;

  // container div
  var keyDiv = null;
  var itemsPerDiv = 5;
  if ((this.key.length == 1) || ((this.key.length % itemsPerDiv) == 0)) {
    keyDiv = document.createElement("div");
    keyDiv.setAttribute('id', this.keyDiv + "" + Math.floor(this.key.length/itemsPerDiv));
    keyDiv.className = 'astroConsoleKeyDiv';
    document.getElementById(this.keyDiv).appendChild(keyDiv);
  } else {
    keyDiv = document.getElementById(this.keyDiv + "" + Math.floor(this.key.length/itemsPerDiv));
  }

  var keyBullet = document.createElement("img");
  keyBullet.setAttribute('alt', name);
  keyBullet.setAttribute('title',name);
  keyBullet.setAttribute('src', this.imagePath + "glowBox_" + currentColor + '.png');
  keyBullet.className ='upcRenderBullet';
  keyDiv.appendChild(keyBullet);
  var keyTitle = document.createElement("span");
  keyTitle.className ='astroConsoleKeyTitle';
  keyTitle.innerHTML = ' ' + name + '<br/>';
  keyDiv.appendChild(keyTitle);
};

/*
 * Get the color of the specified key.
 *
 * Parameter: name - the name of the key
 * Returns: the color of the key
 */
AstroConsole.prototype.getKeyColor = function(name) {
  return (this.keyColors[this.key.indexOf(name)]);
};

/*
 * Removes all of the keys from the console and key array.
 */
AstroConsole.prototype.removeAllKeys = function() {
  var container = document.getElementById(this.keyDiv);
  while(container.hasChildNodes()) {
    container.removeChild(container.lastChild);
  }
  this.key = new Array;
};

/*
 * Map/AstroVector.js
 *
 * This class adds and removes arbitrary vector features to/from a given vector layer.
 * It can save these features so that they may be redrawn on projection switches, for example.
 *
 * Dependencies: AstroMap.js, OpenLayers.js
 */

/*
 * Constructor creates a new vector drawer.
 *
 * Parameters: astroMap            - the map to draw the vectors on
 *             layer               - the layer to draw the vectors on (should be an OL vector layer)
 */
function AstroVector(astroMap, layer) {
  this.astroMap = astroMap;
  this.layer = layer;

  // for storing vectors and their state
  this.storedVectors = [];
  this.styles = [];
  this.selectStyle = new ol.style.Style({
					  fill: new ol.style.Fill({
					    color: 'rgba(255, 128, 0, 0.2)'
					   }),
					  stroke: new ol.style.Stroke({
					    color: '#ff8000',
					    width: 2
					    })
					});

  // index into stored vectors array for vector currently being modified.
  // Is -1 if currently modified vector isn't saved, or if we aren't modifying
  // anything
  this.savedIndex = -1;
};

/*
 * Event handler that handles post-feature modification. Resets the saved index since the
 * feature is done being modified.
 *
 * Parameter: evt - the event object passed by OL. Will contain a feature property.
 * Returns: nothing
 */
AstroVector.prototype.afterVectorFeatureModified = function(evt) {
  this.savedIndex = -1;
};

/*
 * Event handler that handles pre-feature modification. Checks to see if the vector is a
 * stored vector. If it is, saves its index into the saved features array so that it can be updated
 * when modification is done.
 * * Parameter: evt - event object passed by OL. Will contain a feature property.
 * Returns: nothing
 */
AstroVector.prototype.beforeVectorFeatureModified = function(evt) {
  // will be -1 if vector shouldn't be saved
  this.savedIndex = this.getVectorIndex(evt.feature);
};


AstroVector.prototype.centerOnStoredVector = function(index, force) {
  this.centerOnVector(this.storedVectors[index].vectorFeature, force);
};


AstroVector.prototype.centerOnVector = function(vector, force) {

  var currentProjection = this.astroMap.projection;
  var geometry = vector.getGeometry();
  var format = new ol.format.WKT();
  var wkt = format.writeGeometry(geometry);
  var wktPrefix = AstroGeometry.extractGeometryType(wkt);
  var center;

  if (this.astroMap.projection == "cylindrical") {
    if (wktPrefix == "MULTIPOLYGON") {
      geometry = geometry.getPolygon(0);
    }
    if (wktPrefix == "MULTILINESTRING") {
      geometry = geometry.getLineString(0);
    }
  }

  center = ol.extent.getCenter(geometry.getExtent());
  this.astroMap.homeLonLat = center;

  //try not to hop around too much
  var mapE = this.astroMap.map.getView().calculateExtent(this.astroMap.map.getSize());
  var vecE = geometry.getExtent();
  var zoom = false;
  var onMap =  ol.extent.containsExtent(mapE, vecE);
  var scale = 25;
  if (onMap) {
    mapW = Math.abs(mapE[2] - mapE[0]);
    mapH = Math.abs(mapE[3] - mapE[1]);
    vecW = Math.abs(vecE[2] - vecE[0]);
    vecH = Math.abs(vecE[3] - vecE[1]);
    if ((vecW > mapW) || (vecH > mapH)) {
      zoom = true;
    } else {
      wXbig = mapW / vecW;
      hXbig = mapH / vecH;
      if ((wXbig > scale) || (hXbig > scale)) {
	zoom = true;
      }
    }
  } else {
    zoom = true;
  }

  if (force || zoom) {
    this.astroMap.map.getView().fit(geometry, this.astroMap.map.getSize(), {padding: [50,50,50,50]});
  }

};

//
AstroVector.prototype.convertHexColor = function(hexColor, opacity) {
  var color = ol.color.asArray(hexColor);
  color = color.slice();
  color[3] = opacity;
  return(color);
};

/*
 *
 * Parameters: wktString         - the vector to be drawn (EPSG:4326)
 *             attributes        - any properties that describe the feature
 *             color             - the color of the vector (see OL styling)
 *             id                - id to refer to vector for render/unrender
 *             center            - boolean indicating whether or not the map should center itself on this vector when drawn
 *             datelineShift     - boolean indicating whether or not the vector should be duplicated (shifted) so that it
 *                                 it will be viewable from either side of the dateline. Only takes effect in cylindrical
 *                                 projection. Will always perform the shift if the vector crosses the dateline. Default: false.
 * Returns: an object containing vector state information that was stored
 */
AstroVector.prototype.drawAndStore = function(wktString, attributes, color, id, center, datelineShift) {

  var vectorState = this.draw(wktString, attributes, color, id, center, datelineShift);
  vectorState.index = this.storedVectors.length;
  this.storedVectors.push(vectorState);
  return vectorState;
};

/*
 * Draws the vector, splitting and warping it if necessary.
 *
 * Parameters: see drawAndStore()
 * Returns: an object containing vector state information; useful for storing the vector.
 */
AstroVector.prototype.draw = function(wktString, attributes, color, id, center, datelineShift) {
  var vectorState = {};
  var vector;
  var datelineShifted = false;  // keep track of whether or not it was dateline shifted to determine zoom level
  var currentProjection = this.astroMap.projection;
  var geometry;

  // clean up WKT in case there is extra unnecessary whitespace
  wktString = AstroGeometry.cleanWkt(wktString);

  // save state
  vectorState.drawWKT = wktString;  //proj dependent, used for drawing on map
  vectorState.searchWKT = ""; //lan-lon, used for searching
  vectorState.splitWKT = ""; //lan-lon, used for searching
  vectorState.color = color;
  vectorState.id = id;
  vectorState.center = center;
  vectorState.datelineShift = datelineShift;
  if (!attributes) {
    attributes = {};
  }

  var format = new ol.format.WKT();

  if (currentProjection == "cylindrical") {
    geometry = format.readGeometry(wktString);
    var extent = geometry.getExtent();
    var brX = ol.extent.getBottomRight(extent)[0];
    var blX = ol.extent.getBottomLeft(extent)[0];
    var exWidth = ol.extent.getWidth(extent);

    if ((exWidth > 360) || ((brX > 360) && (blX > 360)) || ((brX < 0) && (blX < 0))) {
          wktString = AstroGeometry.undangle(wktString);
    }
    vectorState.searchWKT = wktString;
    if (AstroGeometry.crossesDateline(wktString, currentProjection)) {
      vectorState.splitWKT = AstroGeometry.splitOnDateline(wktString, currentProjection);
    }
    if (datelineShift) {
	vectorState.drawWKT = AstroGeometry.datelineShift(wktString);
    }
  } else {
    //polar
    geometry = format.readGeometry(wktString);
    wktLatLon = format.writeGeometry(geometry, {decimals: 2});
    var wktWarp = wktLatLon;
    vectorState.searchWKT = wktLatLon;
    if (AstroGeometry.crossesDateline(wktString, currentProjection)) {
      vectorState.splitWKT = AstroGeometry.splitOnDateline(wktLatLon, currentProjection);
      wktWarp = AstroGeometry.warpWkt(vectorState.splitWKT);
    } else {
      wktWarp = AstroGeometry.warpWkt(wktLatLon);
    }
    var geometryWarp = format.readGeometry(wktWarp);
    if (currentProjection == "north-polar stereographic") {
      geometryWarp = geometryWarp.transform('EPSG:4326','EPSG:32661');
    } else {
      geometryWarp = geometryWarp.transform('EPSG:4326','EPSG:32761');
    }
    vectorState.drawWKT = format.writeGeometry(geometryWarp, {decimals: 2});
  }

  //console.log('AV wkt draw ' + vectorState.drawWKT);
  //console.log('AV wkt search ' + vectorState.searchWKT);
  //console.log('AV wkt split ' + vectorState.splitWKT);

  // save state:
  vector = format.readFeature(vectorState.drawWKT);
  vector.attributes = attributes;
  vector.attributes.color = color;
  vector.data = attributes;
  vectorState.vectorFeature = vector;

  if (color) {
    if (!this.styles[color]) {
      var currentStyle = new ol.style.Style({
			 fill: new ol.style.Fill({
						   color: this.convertHexColor(color, .2)
						 }),
			 stroke: new ol.style.Stroke({
						       color: this.convertHexColor(color, 1)
						     })
					  });
      this.styles[color] = currentStyle;
    }
    vector.setStyle(this.styles[color]);
  }


  // draw vector
  this.layer.addFeatures([vector]);

  //center on vector
  if ((center) && (this.astroMap.mapsLoaded)) {
    this.centerOnVector(vector);

}
  return vectorState;
};

//
AstroVector.prototype.getExtent = function(index) {
  var ex = [];
  if (this.storedVectors[index] != null) {
    geo = this.storedVectors[index].vectorFeature.getGeometry();
    ex = geo.getExtent();
  }
  return(ex);
};

//
AstroVector.prototype.getFeatureFromAttribute = function(key, value) {
  for (var i = 0; i < this.storedVectors.length; i++) {
    if ((this.storedVectors[i] != null) && (this.storedVectors[i].vectorFeature.attributes[key] == value)) {
      return this.storedVectors[i].vectorFeature;
    }
  }
  return -1;
};

/*
 * Returns the index of the vector feature or -1 if it isn't in the stored vectors
 * list.
 *
 * Parameter: vector - the vector feature to search for
 * Returns: the index of the vector feature
 */
AstroVector.prototype.getVectorIndex = function(vector) {
  for (var i = 0, len = this.storedVectors.length; i < len; i++) {
    if ((this.storedVectors[i] != null) && (this.storedVectors[i].vectorFeature == vector)) {
      return i;
    }
  }
  return -1;
};

//
AstroVector.prototype.getVectorIndexFromAttribute = function(key, value) {
  for (var i = 0, len = this.storedVectors.length; i < len; i++) {
    if ((this.storedVectors[i] != null) && (this.storedVectors[i].vectorFeature.attributes[key] == value)) {
      return i;
    }
  }
  return -1;
};


//
AstroVector.prototype.highlight = function(index) {
  if (this.storedVectors[index] != null) {
    this.storedVectors[index].vectorFeature.setStyle(this.selectStyle);
  }
};


//
AstroVector.prototype.highlightVector = function(vector) {
  var i = this.getVectorIndex(vector);
  this.storedVectors[i].vectorFeature.setStyle(this.selectStyle);
};


//
AstroVector.prototype.isDrawable = function(geometry) {

  var ex = geometry.getExtent();
  var drawable = false;
  switch(astroMap.projection) {
  case 'cylindrical':
    // always draw in cylindrical
    drawable = true;
    break;
  case 'north-polar stereographic':
    drawable = (ol.extent.getBottomRight(ex)[1]>60) ? true : false;
    break;
  case 'south-polar stereographic':
    drawable = (ol.extent.getTopRight(ex)[1]<-60) ? true : false;
    break;
  }
return drawable;

};

/*
 * Redraws the stored vector features.
 *
 * Parameters: none
 * Returns: nothing
 */
AstroVector.prototype.redraw = function() {
  var currentLat = 0;
  var draw = true;  // do we redraw the vector or not?

  for (var i = 0, len = this.storedVectors.length; i < len; i++) {
    if (!this.storedVectors[i]) {
      continue;
    }

    var currentVector = this.storedVectors[i];
    var currentGeo = currentVector.vectorFeature.getGeometry();
    if (this.isDrawable(currentGeo)) {
      //var color = (currentVector) ? currentVector.color : null;
      var vectorState = this.draw(currentVector.searchWKT, currentVector.vectorFeature.attributes,
                          currentVector.color, currentVector.id, currentVector.center,
                          currentVector.datelineShift);
      // update stored vector state
      this.storedVectors[i] = vectorState;
    }
  } //for
};

/*
 * Removes the vector from the map.
 *
 * Parameter: vector - the id of vector to be removed
 * Returns: nothing
 */
AstroVector.prototype.remove = function(vector) {

  if (this.astroMap.controls.select) {
    //this.astroMap.controls.select.setActive(false);
  }
  this.layer.removeFeature(vector);
  if (this.astroMap.controls.select) {
    this.astroMap.controls.select.getFeatures().clear();
  }
};

/*
 * Removes the vector from the map and from the list of stored vectors (so that
 * it won't be redrawn again).
 *
 * Parameter: index - the index into the saved features list identifying the vector to be removed
 * Returns: nothing
 */
AstroVector.prototype.removeAndUnstore = function(index) {
  if (this.storedVectors[index] != null) {
    this.remove(this.storedVectors[index].vectorFeature);
  }
  this.storedVectors[index] = null;
};

/*
 * Removes the vector from the map and from the list of stored vectors (so that
 * it won't be redrawn again).
 *
 * Parameter: vector
 * Returns: nothing
 */
AstroVector.prototype.removeAndUnstoreVector = function(vector) {

  var i = this.getVectorIndex(vector);
  this.removeAndUnstore(i);
};

/*
 * Removes all vector features from the map.
 *
 * Parameters: none
 * Returns: nothing
 */
AstroVector.prototype.removeAll = function() {
  this.layer.removeAllFeatures();
};

/*
 * Removes all vector features from the map and the saved vectors list.
 *
 * Parameters: none
 * Returns: nothing
 */
AstroVector.prototype.removeAndUnstoreAll = function() {

  this.layer.clear();
  this.storedVectors = [];
};

//
//
AstroVector.prototype.updateLayer = function(source) {
  this.layer = source;
  this.redraw();
};


//
AstroVector.prototype.unhighlight = function(index) {
  if (this.storedVectors[index] != null) {
    var color = this.storedVectors[index].vectorFeature.attributes.color;
    this.storedVectors[index].vectorFeature.setStyle(this.styles[color]);
  }
};


//
AstroVector.prototype.unhighlightAll = function() {
  for (var i = 0, len = this.storedVectors.length; i < len; i++) {
    this.unhighlight(i);
  }
};


/*
 * Event handler that handles vector feature modification. Saves the currently modified
 * vector feature if it is marked to be stored.
 *
 * Parameter: evt - the event object passed by OL. Will contain a feature property.
 * Returns: nothing
 */
AstroVector.prototype.vectorFeatureModified = function(evt) {
  if (this.savedIndex != -1) {
    // update array entry with new feature info
    var wkt = this.astroMap.wktParse.write(evt.feature);

    this.storedVectors[this.savedIndex].vectorFeature = evt.feature;
    this.storedVectors[this.savedIndex].drawWKT = wkt;
  }
};


/*
 * Map/AstroBoundingBox.js
 *
 * This class provides support for drawing bounding boxes, as well as
 * the ability to extract important properties from those bounding boxes
 * into the DOM.
 *
 * This class inherits from AstroVector.
 *
 * Dependencies: AstroVector.js, AstroMap.js, OpenLayers.js, AstroLockout.js
 */

// inherit from AstroVector
AstroBoundingBox.prototype = new AstroVector();
AstroBoundingBox.prototype.constructor = AstroBoundingBox;

/*
 * Constructor creates a new bounding box drawer and initializes DOM form fields to
 * hold bounding box info.
 *
 * Parameters: astroMap            - the map to draw the bounding box on
 *             layer               - the layer to draw the bounding boxes on (should be an OL vector layer)
 *             boundingBoxSettings - hash of options
 *
 * The following options may be set:
 *   formIdWKT         - the id of the form field to contain the bounding box's WKT. Default: 'astroBBWKT'
 *   formIdDatelineWKT - the id of the form field to contain the split bounding box's WKT (a multipolygon). Default: 'astroBBDatelineWKT'
 *   formIdTopLeftLon  - the id of the form field to contain the bounding box's top left longitude. Default: 'astroBBTopLeftLon'
 *   formIdTopLeftLat  - the id of the form field to contain the bounding box's top left latitude. Default: 'astroBBTopLeftLat'
 *   formIdBotRightLon - the id of the form field to contain the bounding box's bottom right longitude. Default: 'astroBBBotRightLon'
 *   formIdBotRightLat - the id of the form field to contain the bounding box's bottom right latitude. Default: 'astroBBBotRightLat'
 *   boundingBoxRemoveTrigger              - callback function to handle removal of bounding boxes event. Default: empty function
 *   boundingBoxFeatureSearchResultHandler - callback function to handle results of a feature search. Default: empty function
 */
function AstroBoundingBox(astroMap, layer, boundingBoxSettings) {
  // map to draw bounding boxes on
  this.astroMap = astroMap;

  // layer to draw bboxes on
  this.layer = layer;

  // index into stored vectors array for vector currently being modified.
  // Is -1 if currently modified vector isn't saved, or if we aren't modifying
  // anything
  this.savedIndex = -1;

  // form id defaults
  this.formIdWKT = 'astroBBWKT';
  this.formIdDatelineWKT = 'astroBBDatelineWKT';
  this.formIdTopLeftLon = 'astroBBTopLeftLon';
  this.formIdTopLeftLat = 'astroBBTopLeftLat';
  this.formIdBotRightLon = 'astroBBBotRightLon';
  this.formIdBotRightLat = 'astroBBBotRightLat';
  this.formIdCenterpoint = 'astroBBCenterPoint';
  this.formIdCenterLon = 'astroBBCenterLon';
  this.formIdCenterLat = 'astroBBCenterLat';
  this.formIdLength = 'astroBBLength';

  this.centerPoint = null; //for editing center point

  // event callbacks
  this.boundingBoxRemoveTrigger = function() {};


  // this function is called when an AJAX feature search (using the nomen service) is
  // complete. The function is passed an object containing the results. If an error
  // occurred with the AJAX request, null is returned. If no features were returned
  // (ie. no hits) the object will not be null. The results array will simply be
  // empty.
  this.boundingBoxFeatureSearchResultHandler = function() {};

  // set options
  if (boundingBoxSettings) {
    if (boundingBoxSettings.formIdWKT) {
      this.formIdWKT = boundingBoxSettings.formIdWKT;
    }
    if (boundingBoxSettings.formIdDatelineWKT) {
      this.formIdDatelineWKT = boundingBoxSettings.formIdDatelineWKT;
    }
    if (boundingBoxSettings.formIdTopLeftLon) {
      this.formIdTopLeftLon = boundingBoxSettings.formIdTopLeftLon;
    }
    if (boundingBoxSettings.formIdTopLeftLat) {
      this.formIdTopLeftLat = boundingBoxSettings.formIdTopLeftLat;
    }
    if (boundingBoxSettings.formIdBotRightLon) {
      this.formIdBotRightLon = boundingBoxSettings.formIdBotRightLon;
    }
    if (boundingBoxSettings.formIdBotRightLat) {
      this.formIdBotRightLat = boundingBoxSettings.formIdBotRightLat;
    }
    if (boundingBoxSettings.boundingBoxRemoveTrigger) {
      this.boundingBoxRemoveTrigger = boundingBoxSettings.boundingBoxRemoveTrigger;
    }
    if (boundingBoxSettings.boundingBoxFeatureSearchResultHandler) {
      this.boundingBoxFeatureSearchResultHandler = boundingBoxSettings.boundingBoxFeatureSearchResultHandler;
    }
  }

  // if form elements don't exist, create hidden fields so that
  // there aren't any errors when the code below tries to add text to
  // those fields
/*
  if (document.getElementById(this.formIdWKT) == null) {
    var dummy = document.createElement("input");
    dummy.setAttribute("type", "hidden");
    dummy.setAttribute("id", this.formIdWKT);
    document.body.appendChild(dummy);
  }
  if (document.getElementById(this.formIdDatelineWKT) == null) {
    var dummy = document.createElement("input");
    dummy.setAttribute("type", "hidden");
    dummy.setAttribute("id", this.formIdDatelineWKT);
    document.body.appendChild(dummy);
  }
  if (document.getElementById(this.formIdTopLeftLon) == null) {
    var dummy = document.createElement("input");
    dummy.setAttribute("type", "hidden");
    dummy.setAttribute("id", this.formIdTopLeftLon);
    document.body.appendChild(dummy);
  }
  if (document.getElementById(this.formIdTopLeftLat) == null) {
    var dummy = document.createElement("input");
    dummy.setAttribute("type", "hidden");
    dummy.setAttribute("id", this.formIdTopLeftLat);
    document.body.appendChild(dummy);
  }
  if (document.getElementById(this.formIdBotRightLon) == null) {
    var dummy = document.createElement("input");
    dummy.setAttribute("type", "hidden");
    dummy.setAttribute("id", this.formIdBotRightLon);
    document.body.appendChild(dummy);
  }
  if (document.getElementById(this.formIdBotRightLat) == null) {
    var dummy = document.createElement("input");
    dummy.setAttribute("type", "hidden");
    dummy.setAttribute("id", this.formIdBotRightLat);
    document.body.appendChild(dummy);
  }
*/
};

/*
 * Draws the bbox and stores the state so that it can be redrawn on projection switch.
 * Removes any previously drawn bbox from the layer.
 *
 * Parameter: wktString - bbox wkt (EPSG:4326)
 * Returns: an object containing bbox state information that was stored; null if the WKT was bad or something else went wrong.
 */
AstroBoundingBox.prototype.drawAndStore = function(wkt, dontResetForm, center) {

  if (!center) {
    center = true;
  }
  this.multiVectorEdit = this.astroMap.controls.multiVectorEdit;
  if ((this.multiVectorEdit) && (document.getElementById(this.formIdWKT).value != '') && (wkt.indexOf("MULTI") == -1)) {
    wkt = this.mergeVectors(wkt, document.getElementById(this.formIdWKT).value);
  }
  //nix old wkt
  this.removeAndUnstoreAll(dontResetForm);

  // use superclass's overridden drawAndStore() method
  var bboxState = AstroVector.prototype.drawAndStore.call(this, wkt, null, null, "footprint", center, false);
  this.centerOnVector(bboxState.vectorFeature, true);


  if (bboxState != null) {
    //always check for dateline split
    if (document.getElementById(this.formIdDatelineWKT)) {
      document.getElementById(this.formIdDatelineWKT).value = bboxState.splitWKT;
    }
    if (!dontResetForm)  {
      this.populateForm(bboxState.drawWKT, bboxState.searchWKT, bboxState.splitWKT);
    }
  }

  return bboxState;
};

/*
 * Draw from lat/lon bounds found in form fields.
 *
 * Parameters: none
 * Returns: an object containing bbox state information that was stored; null if the WKT was bad or something else went wrong.
 */
AstroBoundingBox.prototype.drawFromBounds = function(dontResetForm) {
  var tlx, tly, brx, bry;

  // grab bounds from form fields
  tlx = document.getElementById(this.formIdTopLeftLon).value;
  tly = document.getElementById(this.formIdTopLeftLat).value;
  brx = document.getElementById(this.formIdBotRightLon).value;
  bry = document.getElementById(this.formIdBotRightLat).value;

  // make sure we have all 4 bounds
  if (tlx.length < 1 || tly.length < 1 || brx.length < 1 || bry.length < 1) {return null;}

  // build bbox wkt
  if (Number(tlx) > Number(brx)) {  //dateline crosser (using left-most-least rule on lons)
    //brx = Number(brx) + 360;
      var polePoint1 = '';
      var polePoint2 = '';
      var borderY = 100; //defaults off map
      if ((Number(tly) == 90) || (Number(bry) == 90)) {
	  polePoint1 = brx + " 90,";
	  polePoint2 = tlx + " 90,";
	  borderY = (Number(tly) > Number(bry)) ? Number(bry) : Number(tly);
      }
      if ((Number(tly) == -90) || (Number(bry) == -90)) {
	  polePoint1 = brx + " -90,";
	  polePoint2 = tlx + " -90,";
	  borderY = (Number(tly) < Number(bry)) ? Number(bry) : Number(tly);
      }

      if (Number(borderY) != 100) { //pole crosser
	  var midPoint1 = ((Number(tlx) + Number(brx))/2).toString() + " " + borderY + ",";
	  wkt = "POLYGON((" + tlx + " " + borderY + "," +
	      midPoint1 +
	      brx + " " + borderY + "," +
	      polePoint1 +
	      polePoint2 +
	      tlx + " " + borderY + "))";
      } else {
        //elim spans >180
	var crossPoint1 = (Math.floor((Number(brx) + Number(tlx))/2)).toString() + ' ' + tly + ',';
	var crossPoint2 = (Math.floor((Number(brx) + Number(tlx))/2)).toString() + ' ' + bry + ",";
	wkt = "POLYGON((" + tlx + " " + tly + "," +
	      //crossPoint1 +
	      brx + " " + tly + "," +
	      brx + " " + bry + "," +
	      //crossPoint2 +
	      tlx + " " + bry + "," +
	      tlx + " " + tly + "))";
	wkt = AstroGeometry.splitOnDateline(wkt,this.astroMap.projection);
      }
      dontResetForm=true;
  } else {
    //add mids
    var midPoint1 = ((Number(tlx) + Number(brx))/2).toString() + ' ' + tly + ",";
    var midPoint2 = ((Number(tlx) + Number(brx))/2).toString() + ' ' + bry + ",";
    wkt = "POLYGON((" + tlx + " " + tly + "," +
      midPoint1 +
      brx + " " + tly + "," +
      brx + " " + bry + "," +
      midPoint2 +
      tlx + " " + bry + "," +
      tlx + " " + tly + "))";
  }
  document.getElementById(this.formIdWKT).value = wkt;
  return this.drawAndStore(wkt, dontResetForm);

};


AstroBoundingBox.prototype.drawFromControl = function(wkt) {

  //convert polars
  if (this.astroMap.projection != 'cylindrical') {
    var format = new ol.format.WKT();
    geometry = format.readGeometry(wkt);
    if (this.astroMap.projection == 'north-polar stereographic') {
      geometry = geometry.transform('EPSG:32661','EPSG:4326');
    } else {
      geometry = geometry.transform('EPSG:32761','EPSG:4326');
    }
    if (!AstroVector.prototype.isDrawable(geometry)) {
      alert('Bounding Box is not visable in this projection!');
      return null;
    }
    wkt = format.writeGeometry(geometry);

  }
  return this.drawAndStore(wkt);
};


/*
 * Draw from form (wkt textarea).
 *
 * Parameters: none
 * Returns: an object containing bbox state information that was stored; null if the WKT was bad or something else went wrong.
 */
AstroBoundingBox.prototype.drawFromForm = function() {
  var wkt = document.getElementById(this.formIdWKT).value;
  if (wkt) {
    //wkt = this.polarSafeWKT(wkt);
    return this.drawAndStore(wkt);
  }
  else {
    return null;
  }
};

/*
 * Draw from template uploaded to server.
 *
 * Parameter: wkt - the wkt string
 * Returns: an object containing bbox state information that was stored; null if the WKT was bad or something else went wrong.
 */
AstroBoundingBox.prototype.drawFromServerUpload = function(wkt) {
  if (wkt) {
    var wktBound = this.astroMap.minorReprojectWKT(wkt, true);
    return this.drawAndStore(wktBound);
  }
  else {
    return null;
  }
};

 /*
 * Draw from OL map extent bounds.
 *
 * Parameters: none
 * Returns: an object containing bbox state information that was stored; null if the WKT was bad or something else went wrong.
 */
AstroBoundingBox.prototype.drawFromMapExtent = function() {
  var bounds = this.astroMap.map.getExtent();
  document.getElementById(this.formIdTopLeftLon).value = (bounds.left <0) ? '' : bounds.left;
  document.getElementById(this.formIdTopLeftLat).value = (bounds.top > 90) ? '' : bounds.top;
  document.getElementById(this.formIdBotRightLon).value = (bounds.right > 360) ? '' : bounds.right;
  document.getElementById(this.formIdBotRightLat).value = (bounds.bottom < -90) ? '' : bounds.bottom;
  return this.drawFromBounds();
};

 /*
 * Draw from CP and Diameter
 *
 * Parameters: none
 * Returns: an object containing bbox state information that was stored; null if the WKT was bad or something else went wrong.
 */
AstroBoundingBox.prototype.drawFromCenterPointAndDiameter = function() {
  var leftlon = document.getElementById(this.formIdTopLeftLon).value;
  var wkt = document.getElementById(this.formIdWKT).value;
  var centerlat = document.getElementById(this.formIdCenterLat).value;
  var centerlon = document.getElementById(this.formIdCenterLon).value;
  var diameter =  document.getElementById(this.formIdLength).value;
  if ((!centerlat) || (!centerlon) || (Number(diameter) <= 0)) {return null;}
  document.getElementById(this.formIdTopLeftLon).value = centerlon;
  document.getElementById(this.formIdTopLeftLat).value = centerlat;
  document.getElementById(this.formIdBotRightLon).value = centerlon;
  document.getElementById(this.formIdBotRightLat).value = centerlat;
  document.getElementById(this.formIdCenterpoint).value = 'POINT(' + centerlon + ' ' + centerlat + ')';
  document.getElementById(this.formIdWKT).value = 'POINT(' + centerlon + ' ' + centerlat + ')';
  return null;
};

 /*
 * Populate Form
 *
 * Parameters: none
 * Returns: none
 */
AstroBoundingBox.prototype.populateForm = function(drawWKT, searchWKT, splitWKT) {

  var wktParser = new ol.format.WKT();
  var newCenter = null;
  var drawFeature = wktParser.readFeature(drawWKT);
  var drawGeometry = drawFeature.getGeometry();
  var truncate = this.astroMap.controls.decimalPlaces;
  var searchFeature = wktParser.readFeature(searchWKT);
  var searchGeometry = searchFeature.getGeometry();
  var splitFeature = '';
  var splitGeometry = '';


  //wkt and centerwkt (must be in standard coordinates)
  document.getElementById(this.formIdWKT).value = searchWKT;
  if ((splitWKT != '') && (document.getElementById(this.formIdDatelineWKT))) {
    splitFeature = wktParser.readFeature(splitWKT);
    splitGeometry = splitFeature.getGeometry();
    splitGeometry = splitGeometry.transform('EPSG:4326','truncate');
    splitWKT = wktParser.writeGeometry(splitGeometry);
    document.getElementById(this.formIdDatelineWKT).value = splitWKT;
  }
  if (document.getElementById(this.formIdCenterpoint)) {
   // newCenter = searchGeometry.getCentroid();
   // var newCenterx = (truncate) ? newCenter.x.toFixed(truncate) : newCenter.x;
   // var newCentery = (truncate) ? newCenter.y.toFixed(truncate) : newCenter.y;
   // document.getElementById(this.formIdCenterpoint).value = 'POINT(' + newCenterx + ' ' + newCentery + ')';
  }

  //for dont-convert requests (nomen), switch to target coordinates
/*
  if (this.astroMap.controls.dontConvertForm) {
    wkt = this.astroMap.minorReprojectWKT(wkt, false);
    if (searchWKT && (searchWKT != 'undefined')) {
      searchWKT = this.astroMap.minorReprojectWKT(searchWKT, false);
    }
    drawGeometry = wktParser.read(wkt).geometry;
  }
*/
  //var newGeoType = drawGeometry.CLASS_NAME;

  //bounds
  if (document.getElementById(this.formIdTopLeftLon)) {
    var ex = searchGeometry.getExtent();
    var maxY = ol.extent.getTopRight(ex)[1];
    var minY = ol.extent.getBottomRight(ex)[1];
    if (splitWKT != '') {  //goes over 360 line
      var maxX = ol.extent.getBottomLeft(ex)[0];
      var minX = ol.extent.getBottomRight(ex)[0];
      var exSplit = splitGeometry.getExtent();
      if ((this.astroMap.projection == 'north-polar stereographic') && (ol.extent.getTopRight(exSplit)[1] == 90)){
	maxY = 90;
      }
      if ((this.astroMap.projection == 'south-polar stereographic') && (ol.extent.getBottomRight(exSplit)[1] == -90)){
	minY = -90;
      }
    } else {
      var maxX = ol.extent.getBottomRight(ex)[0];
      var minX = ol.extent.getBottomLeft(ex)[0];
    }
    var highLon = (this.astroMap.longitudeDirection == 'PositiveWest') ? maxX : minX;
    var lowLon = (this.astroMap.longitudeDirection == 'PositiveWest') ? minX : maxX;
    document.getElementById(this.formIdTopLeftLon).value = (truncate) ? highLon.toFixed(truncate) : highLon;
    document.getElementById(this.formIdBotRightLon).value = (truncate) ? lowLon.toFixed(truncate) : lowLon;
    document.getElementById(this.formIdTopLeftLat).value = (truncate) ? maxY.toFixed(truncate) : maxY;
    document.getElementById(this.formIdBotRightLat).value = (truncate) ? minY.toFixed(truncate) : minY;
  }
  /*
  if (document.getElementById(this.formIdCenterLat)) {
    newCenter = drawGeometry.getCentroid();
    document.getElementById(this.formIdCenterLon).value = (truncate) ? newCenter.x.toFixed(truncate) : newCenter.x;
    document.getElementById(this.formIdCenterLat).value = (truncate) ? newCenter.y.toFixed(truncate) : newCenter.y;
  }
  /*
  if (document.getElementById(this.formIdLength)) {
    var length = 0;
    if (newGeoType.indexOf("Polygon") != -1) {
      var bounds = drawGeometry.getBounds();
      boundsA = bounds.toArray();
      var centerLat = drawGeometry.getCentroid().y;
      var latLength = AstroGeometry.LatLonToKM(boundsA[1], 0, boundsA[3], 0, this.astroMap.aAxisRadius, this.astroMap.cAxisRadius);
      var lonLength = AstroGeometry.LatLonToKM(centerLat, boundsA[0], centerLat, boundsA[2], this.astroMap.aAxisRadius, this.astroMap.cAxisRadius);
      length = (Number(latLength) > Number(lonLength)) ? latLength : lonLength;
    } else if (newGeoType.indexOf("LineString") != -1) {
      length = AstroGeometry.getLengthOfLine(drawGeometry, this.astroMap.aAxisRadius, this.astroMap.cAxisRadius, this.astroMap.projection);
    }
    document.getElementById(this.formIdLength).value = length;
  }
*/
};


/*
 * Removes the bounding box from the map layer and stops storing it
 * so that it won't be redrawn. Clears the form elements as well.
 *
 * Parameters: none
 * Returns: nothing
 */
AstroBoundingBox.prototype.removeAndUnstoreAll = function(dontResetForm) {
  // call overridden superclass method
  AstroVector.prototype.removeAndUnstoreAll.call(this);

  this.boundingBoxRemoveTrigger();

  if (!dontResetForm) {
    var elements = [this.formIdWKT, this.formIdDatelineWKT,  this.formIdCenterpoint, this.formIdCenterLon, this.formIdCenterLat,
		    this.formIdTopLeftLon, this.formIdTopLeftLat, this.formIdBotRightLon, this.formIdBotRightLat, this.formIdLength];
    for (var i = 0; i < elements.length; i++) {
      if (document.getElementById(elements[i])) {
	document.getElementById(elements[i]).value = "";
      }
    }
  }
};

/*
 * Performs an AJAX search on the nomenclature database for matching feature names. The results object is
 * passed to the boundingBoxFeatureSearchResultHandler function.
 *
 * Parameter: featureQuery (string) - the feature name to be searched for
 * Returns: nothing (results passed to callback since they are obtained asynchronously)
 */
AstroBoundingBox.prototype.featureSearch = function(featureQuery) {
  // to lock the div while ajax is loading
  var astroLockout = new AstroLockout();

  // build the nomen web service url
  var nomenUrl = "http://planetarynames.wr.usgs.gov/SearchResults?target=MARS&feature=" + featureQuery + "&displayType=JSON";
  nomenUrl = encodeURIComponent(nomenUrl);

  // need to use a proxy to circumvent cross-domain scripting limitation
  var proxyUrl = "http://kirks.wr.usgs.gov/cgi-bin/proxy.cgi?url=" + nomenUrl;

  var success = function(response) {
    // grab response JSON and pass it to callback
    var searchResults = eval("(" + response.responseText + ")");  // this isn't very safe... should we do this some other way?
    this.boundingBoxFeatureSearchResultHandler(searchResults);

    astroLockout.off("featureSearch");
  };

  var error = function(response) {
    // if there was an error, pass a null object to handler
    this.boundingBoxFeatureSearchResultHandler(null);
    astroLockout.off("featureSearch");
  };

  // set lockout
  astroLockout.on("featureSearch", true);

  // perform ajax request
  OpenLayers.loadURL(proxyUrl, "", this, success, error);
};

/*
 * Scales a bounding box geometry by the given factor. For example, if factor
 * is 2, the geometry will be doubled in size.
 *
 * Parameters: wkt (string) - the wkt of the bounding box
 *             factor (float) - the factor to scale the bounding box by
 * Returns: wkt for the padded bounding box, null if the supplied wkt was malformed
 */
AstroBoundingBox.prototype.scaleBoundingBox = function(wkt, factor) {
  // read wkt into a feature
  var feature = this.astroMap.wktParseS.read(wkt);
  if (feature != null) {
    // create point of origin, which is the centroid of the original wkt.
    // This is necessary for the resize method so sliding doesn't occur.
    var origin = feature.geometry.getCentroid();

    // resize geometry and return wkt
    feature.geometry.resize(factor, origin);
    return this.astroMap.wktParseS.write(feature);
  }
  else {
    // bad wkt
    return null;
  }
};

/*
 * Event handler that saves the currently modified bounding box feature.
 *
 * Parameter: evt - the event object passed by OL. Will contain a feature property.
 * Returns: nothing
 */
AstroBoundingBox.prototype.vectorFeatureModified = function(evt) {

  // call overridden superclass's method
  AstroVector.prototype.vectorFeatureModified.call(this, evt);

  var newGeo = this.astroMap.wktParseR.read(evt.feature.geometry.toString()).geometry;
  var modifyControl = null;
  var centerPointEdit = false;
  var oldGeo = newGeo;
  if (this.astroMap.controls.controls['editCenterPoint']) {
    var active =  this.astroMap.controls.panel.getControlsBy('active',true);
    for (var i = 0; i < active.length; i++) {
      if (active[i].displayClass == "olControlEditCenterPoint") {
	centerPointEdit = true;
	if (this.astroMap.controls.dontConvertForm) { //must return to minor
	  newGeo = this.astroMap.minorReprojectGeo(newGeo, false);
	}
	newCenter = newGeo;
	var truncate = this.astroMap.controls.decimalPlaces;
	var newCenterx = (truncate) ? newCenter.x.toFixed(truncate) : newCenter.x;
	var newCentery = (truncate) ? newCenter.y.toFixed(truncate) : newCenter.y;
	if (this.astroMap.controls.dontConvertForm) {
	  this.setCenterWKT(oldGeo.x, oldGeo.y); //don't put converted in center wkt (nomen)
	} else {
	  this.setCenterWKT(geo.x, geo.y);
	}
	document.getElementById(this.formIdCenterLon).value = newCenterx;
	document.getElementById(this.formIdCenterLat).value = newCentery;
      } else {
	modifyControl = active[i];
      }
    }
  }
  if (!centerPointEdit) {
    var geometry = newGeo;
    if (astroMap.controls.decimalPlaces) {
      OpenLayers.Projection.addTransform("LatLonTruncate", "EPSG:4326", AstroGeometry.transformCylindricalToLatLon);
      OpenLayers.Projection.addTransform("EPSG:4326", "LatLonTruncate", astroMap.controls.transformDecimalPlaces);
      var latLon = new OpenLayers.Projection("EPSG:4326");
      var latLonTruncate = new OpenLayers.Projection("LatLonTruncate");
      geometry = geometry.transform(latLon, latLonTruncate);
    }
    var wkt = geometry.toString();
    //this.populateForm(wkt);
    var bbstate = this.drawAndStore(wkt);
    if (modifyControl) {
      modifyControl.selectFeature(bbstate.vectorFeature);
    }
  }
};

//
AstroBoundingBox.prototype.editCenterPointStart = function(evt) {

  var wkt=document.getElementById('astroBBCenterPoint').value;
  if (!this.centerPoint) {
    this.centerPoint = this.astroMap.boundingBoxDrawer.draw(wkt, null, "blue");
  }
  this.astroMap.controls.controls['editCenterPoint'].selectFeature(this.centerPoint.vectorFeature);
};

//
AstroBoundingBox.prototype.editCenterPointStop = function(evt) {

  if (this.centerPoint) {
    this.astroMap.boundingBoxDrawer.remove(this.centerPoint.vectorFeature);
  }
  this.centerPoint = null;
};


AstroBoundingBox.prototype.polarSafeWKT = function(wkt) {

  if (this.astroMap.projection != 'cylindrical') {
    var format = new ol.format.WKT();
    geometry = format.readGeometry(wkt);
    if (this.astroMap.projection == 'north-polar stereographic') {
      geometry = geometry.transform('EPSG:4326','EPSG:32661');
    } else {
      geometry = geometry.transform('EPSG:4326','EPSG:32761');
    }
    wkt = format.writeGeometry(geometry);
  }
  return(wkt);
};


//
AstroBoundingBox.prototype.setCenterWKT = function(x, y) {

  var e = document.getElementById(this.formIdCenterpoint);
  var convertWKT = false;
  if (e) {
    if (!x || !y) { //pull from form
      x = document.getElementById(this.formIdCenterLon).value;
      y = document.getElementById(this.formIdCenterLat).value;
      if (this.astroMap.controls.dontConvertForm) {convertWKT = true;}
    }
    var truncate = this.astroMap.controls.decimalPlaces;
    var centerx = (truncate) ? x.toFixed(truncate) : x;
    var centery = (truncate) ? y.toFixed(truncate) : y;
    var newWKT = 'POINT(' + centerx + ' ' + centery + ')';
    if (convertWKT) {
      newWKT = this.astroMap.minorReprojectWKT(newWKT, false);
    }
    e.value = newWKT;
  }
};

//
AstroBoundingBox.prototype.mergeVectors = function(wkt1, wkt2) {
  var wktParser = astroMap.wktParse;
  var vector1 = wktParser.read(wkt1).geometry;
  var vector2 = wktParser.read(wkt2).geometry;
  var vectorArray = [];
  if (wkt2.indexOf("MULTI") != -1) {
    vectorArray = vector2.components.concat(vector1);
  } else {
    vectorArray = [vector1, vector2];
  }
  if (wkt1.indexOf("POLYGON") != -1) {
    var wktNew = new OpenLayers.Geometry.MultiPolygon(vectorArray).toString();
  } else {
    var wktNew = new OpenLayers.Geometry.MultiLineString(vectorArray).toString();
  }
  return(wktNew);
};

//
//
AstroBoundingBox.prototype.updateLayer = function(source) {
  this.layer = source;
  this.redraw();
};/*
 * Map/AstroPoi.js
 *
 * add poi's (points of interest) to the poi layer
 *
 * Dependencies: AstroMap.js, OpenLayers.js
 */

/*
 *
 * Parameters: astroMap            - the map to draw the vectors on
 *             layer               - the layer to draw the vectors on (should be an OL vector layer)
 */
function AstroPoi(astroMap, layer) {
  this.astroMap = astroMap;
  this.layer = layer;

  // for storing vectors and their state
  this.storedPois = [];
  this.styles = [];
  this.selectStyle = new ol.style.Style({
					  fill: new ol.style.Fill({
					    color: 'rgba(255, 128, 0, 0.2)'
					   }),
					  stroke: new ol.style.Stroke({
					    color: '#ff8000',
					    width: 2
					    })
					});

  this.savedIndex = -1;
};


/*
 * Center on
 *
 * Parameter: point (vector)
 * Returns: nothing
 */
AstroPoi.prototype.centerOn = function(point) {

  var currentProjection = this.astroMap.projection;
  var center;
  var geometry = point.getGeometry();

  center = ol.extent.getCenter(geometry.getExtent());
  this.astroMap.homeLonLat = center;
  this.astroMap.map.getView().fit(geometry, this.astroMap.map.getSize(), {padding: [50,50,50,50]});
};

//
AstroPoi.prototype.convertHexColor = function(hexColor, opacity) {
  var color = ol.color.asArray(hexColor);
  color = color.slice();
  color[3] = opacity;
  return(color);
};

/*
 *
 * Parameters: lat lon           - the point to be drawn
 *             attributes        - any properties that describe the feature
 *             color             - the color of the vector (see OL styling)
 *             id                - id to refer to vector for render/unrender
 *             center            - boolean -  map should center itself on point
 * Returns: an object containing vector state information that was stored
 */
AstroPoi.prototype.drawAndStore = function(lat, lon, attributes, id, center) {

  var poiState = this.draw(lat, lon, attributes, id, center);
  poiState.index = this.storedPois.length;
  this.storedPois.push(poiState);
  return poiState;
};

/*
 * Draws the poi
 *
 */
AstroPoi.prototype.draw = function(lat, lon, attributes, id, center) {
  var poiState = {};
  var poi;
  var currentProjection = this.astroMap.projection;
  var geometry;

  // clean up WKT in case there is extra unnecessary whitespace
  wktString = this.makePoint(lat, lon);

  // save state
  poiState.WKT = 'POINT(' + lon + ' ' + lat + ')';
  poiState.id = id;
  poiState.center = center;
  if (!attributes) {
    attributes = {};
  }

  var format = new ol.format.WKT();

  if (currentProjection != "cylindrical") {
    //polar
    geometry = format.readGeometry(poiState.WKT);
    if (currentProjection == "north-polar stereographic") {
      geometry = geometry.transform('EPSG:4326','EPSG:32661');
    } else {
      geometry = geometry.transform('EPSG:4326','EPSG:32761');
    }
    wktLatLon = format.writeGeometry(geometry, {decimals: 2});
    poiState.WKT = wktLatLon;
  }

  //console.log('AP wkt ' + poiState.WKT);

  // save state:
  poi = format.readFeature(poiState.WKT);
  poi.attributes = attributes;
  poi.data = attributes;
  poiState.vectorFeature = poi;

  /*
  if (color) {
    if (!this.styles[color]) {
      var currentStyle = new ol.style.Style({
			 fill: new ol.style.Fill({
						   color: this.convertHexColor(color, .2)
						 }),
			 stroke: new ol.style.Stroke({
						       color: this.convertHexColor(color, 1)
						     })
					  });
      this.styles[color] = currentStyle;
    }
    poi.setStyle(this.styles[color]);
  }
*/

  // draw poi
  this.layer.addFeatures([poi]);

  //center on poi
  //if ((center) && (this.astroMap.mapsLoaded)) {
  //  this.centerOn(poi);
  //}

  return poiState;
};


//
AstroPoi.prototype.getFeatureFromAttribute = function(key, value) {
  for (var i = 0; i < this.storedPois.length; i++) {
    if ((this.storedPois[i] != null) && (this.storedPois[i].vectorFeature.attributes[key] == value)) {
      return this.storedPois[i].vectorFeature;
    }
  }
  return -1;
};

/*
 * Returns the index of the vector feature or -1 if it isn't in the stored vectors
 * list.
 *
 * Parameter: vector - the vector feature to search for
 * Returns: the index of the vector feature
 */
AstroPoi.prototype.getVectorIndex = function(vector) {
  for (var i = 0, len = this.storedPois.length; i < len; i++) {
    if ((this.storedPois[i] != null) && (this.storedPois[i].vectorFeature == vector)) {
      return i;
    }
  }
  return -1;
};

//
AstroPoi.prototype.getVectorIndexFromAttribute = function(key, value) {
  for (var i = 0, len = this.storedPois.length; i < len; i++) {
    if ((this.storedPois[i] != null) && (this.storedPois[i].vectorFeature.attributes[key] == value)) {
      return i;
    }
  }
  return -1;
};


//
AstroPoi.prototype.highlight = function(index) {
  if (this.storedPois[index] != null) {
    this.storedPois[index].vectorFeature.setStyle(this.selectStyle);
  }
};


//
AstroPoi.prototype.highlightVector = function(vector) {
  var i = this.getVectorIndex(vector);
  this.storedPois[i].vectorFeature.setStyle(this.selectStyle);
};


//
AstroPoi.prototype.isDrawable = function(geometry) {

  var ex = geometry.getExtent();
  var drawable = false;
  switch(astroMap.projection) {
  case 'cylindrical':
    // always draw in cylindrical
    drawable = true;
    break;
  case 'north-polar stereographic':
    drawable = (ol.extent.getBottomRight(ex)[1]>60) ? true : false;
    break;
  case 'south-polar stereographic':
    drawable = (ol.extent.getTopRight(ex)[1]<-60) ? true : false;
    break;
  }
return drawable;

};

//
AstroPoi.prototype.makePoint = function(lat, lon) {
  point = 'POINT(' + lon + ',' + lat + ')';
  return point;
};

/*
 * Redraws the stored vector features.
 *
 * Parameters: none
 * Returns: nothing
 */
AstroPoi.prototype.redraw = function() {
  var currentLat = 0;
  var draw = true;  // do we redraw the vector or not?

  for (var i = 0, len = this.storedPois.length; i < len; i++) {
    if (!this.storedPois[i]) {
      continue;
    }

    var currentVector = this.storedPois[i];
    var currentGeo = currentVector.vectorFeature.getGeometry();
    if (this.isDrawable(currentGeo)) {
      //var color = (currentVector) ? currentVector.color : null;
      var vectorState = this.draw(currentVector.searchWKT, currentVector.vectorFeature.attributes,
                          currentVector.color, currentVector.id, currentVector.center,
                          currentVector.datelineShift);
      // update stored vector state
      this.storedPois[i] = vectorState;
    }
  } //for
};

/*
 * Removes the vector from the map.
 *
 * Parameter: vector - the id of vector to be removed
 * Returns: nothing
 */
AstroPoi.prototype.remove = function(vector) {

  if (this.astroMap.controls.select) {
    this.astroMap.controls.select.setActive(false);
  }
  this.layer.removeFeature(vector);
  if (this.astroMap.controls.select) {
    this.astroMap.controls.select.getFeatures().clear();
  }
};

/*
 * Removes the vector from the map and from the list of stored vectors (so that
 * it won't be redrawn again).
 *
 * Parameter: index - the index into the saved features list identifying the vector to be removed
 * Returns: nothing
 */
AstroPoi.prototype.removeAndUnstoreAll = function() {

  for(var p in this.storedPois) {
    this.remove(this.storedPois[p].vectorFeature);
  }
  this.storedPois = null;
};

/*
 * Removes the vector from the map and from the list of stored vectors (so that
 * it won't be redrawn again).
 *
 * Parameter: vector
 * Returns: nothing
 */
AstroPoi.prototype.removeAndUnstoreVector = function(vector) {

  var i = this.getVectorIndex(vector);
  this.removeAndUnstore(i);
};

/*
 * Removes all vector features from the map.
 *
 * Parameters: none
 * Returns: nothing
 */
AstroPoi.prototype.removeAll = function() {
  this.layer.removeAllFeatures();
};

/*
 * Removes all vector features from the map and the saved vectors list.
 *
 * Parameters: none
 * Returns: nothing
 */
AstroPoi.prototype.removeAndUnstoreAll = function() {

  this.layer.clear();
  this.storedPois = [];
};

//
//
AstroPoi.prototype.updateLayer = function(source) {
  this.layer = source;
  this.redraw();
};


//
AstroPoi.prototype.unhighlight = function(index) {
  if (this.storedPois[index] != null) {
    var color = this.storedPois[index].vectorFeature.attributes.color;
    this.storedPois[index].vectorFeature.setStyle(this.styles[color]);
  }
};


//
AstroPoi.prototype.unhighlightAll = function() {
  for (var i = 0, len = this.storedPois.length; i < len; i++) {
    this.unhighlight(i);
  }
};


/*
 * Map/Control/AstroControls.js
 *
 * Class to add OpenLayers controls.
 *
 * Dependencies: OpenLayers.js, AstroMap.js, OpenLayers/Controls/*
 */

/*
 * Constructor initializes a new set of map controls.
 *
 * Parameters: astroMap        - reference to the map that the controls should be attached to
 *             controlSettings - hash of control options (see below)
 *
 * The following options may be set:
 *   zoomBar                             - turn zoom bar on or off (boolean). Default: false
 *   layerSwitcher                       - turn layer switcher on or off (boolean). Default: false
 *   graticule                           - turn graticule on or off (boolean). Default: false
 *   featureSearch                       - turn feature search on or off (boolean). Default: false
 *   scaleLine                           - turn scale line on or off (boolean). Default: false
 *   overviewMap                         - turn overview map on or off (boolean). Default: false
 *   mousePosition                       - turn mouse lon/lat position on or off (boolean). Default: false
 *   zoomButton                          - turn zoom button on or off (boolean). Default: false
 *   boundingBoxDrawer                   - turn bounding box drawer button on or off (boolean). Default: false
 *   editGeometryButton                  - turn geometry edit button on or off (string). Values can be one of
 *                                         'none', 'both', 'vector', or 'bbox'. Default: 'none'
 *   selectButton                        - turn feature select button on or off (boolean). Default: false
 *   rubberBandSelectButton              - turn rubberband feature select button on or off (boolean). Default: false
 *   homeButton                          - turn home button on or off (boolean). Default: false
 *   defaultLayerSwitcherBackgroundColor - the color of the layer switcher's background. Default: '#e3701a'
 *   defaultSelectStrokeColor            - the color of the stroke used when a feature is selected. Default: 'yellow'
 *   defaultSelectFillColor              - the color of the fill used when a feature is selected. Default: '#ff6600'
 *   boundingBoxDrawHandler              - callback function for when bounding boxes are drawn.
 *                                         Default: function that puts bbox WKT in form field and draws the bounding
 *                                         box on the map, zooming to it. (AstroBoundingBox.js)
 *   zoomEndHandler                      - callback function for when zooming has finished. Default: empty function
 *   selectHandler                       - callback function for when a feature select occurs. Default: empty function
 *   unselectHandler                     - callback function for when a feature unselect occurs. Default: empty function
 */

//document.olLayerSwitcherHook = function () {console.log('yo');};

function AstroControls(astroMap, controlSettings) {
  // instance variables
  this.astroMap = astroMap; // map to put controls on
  this.controlSettings = controlSettings;
  this.buttons = [];
  this.buttonTop = 85;
  this.buttonMargin = 30;
  this.imagePath = this.astroMap.imagePath;
  this.layersWithSliders = [];
  this.mouseLonLatDiv = "astroConsoleLonLat";
  this.scaleline = null;
  this.graticule=null;

  // default styles
  this.defaultLayerSwitcherBackgroundColor = '#e3701a';
  this.defaultSelectStrokeColor = 'yellow';
  this.defaultSelectFillColor = '#ff6600';

  // state switches
  this.zoomBarOn = false;
  this.decimalPlaces = null;
  this.layerSwitcherOn = false;
  this.graticuleOn = false;
  this.featureSearchOn = false;
  this.scaleLineOn = false;
  this.overviewMapOn = false;
  this.mousePositionOn = false;
  this.dontConvertForm = false;
  this.navButtonOn = false;
  this.boundingBoxButtonOn = false;
  this.circleButton = false;
  this.lineButton = false;
  this.pointButton = false;
  this.measureButton = false;
  this.resizeGeometryButton = false;
  this.reshapeGeometryButton = false;
  this.transformGeometryButton = false;
  this.editCenterPointButton = false;
  this.multiVectorEdit = false;
  this.selectButtonoOn = false;
  this.rubberBandSelectButton = false;
  this.homeButtonOn = false;
  this.expandButtonOn = false;
  this.downloadButtonOn = false;
  this.panel = null;
  this.defaultControl = null;
  this.controls = {};
  this.draw = null;
  this.select = null;

  // event callbacks
  this.zoomEndHandler = function() {};
  this.selectHandler = function() {console.log('here');};
  this.boundingBoxDrawHandler = function() {};
  this.unselectHandler = function() {};
  this.editHandler = function() {};
  this.measureHandler = function() {};
  this.expandHandler = function() {};

  // set up vars based on passed settings
  if (controlSettings) {
    if (controlSettings.zoomBar) {this.zoomBarOn = true;}
    if (controlSettings.layerSwitcher) {this.layerSwitcherOn = true;}
    if (controlSettings.graticule) {this.graticuleOn = true;}
    if (controlSettings.featureSearch) {this.featureSearchOn = true;}
    if (controlSettings.scaleLine) {this.scaleLineOn = true;}
    if (controlSettings.overviewMap) {this.overviewMapOn = true;}
    if (controlSettings.mousePosition) {this.mousePositionOn = true;}
    if (controlSettings.dontConvertForm) {this.dontConvertForm = true;}
    if (controlSettings.navButton) {this.navButtonOn = true;}
    if (controlSettings.boundingBoxDrawer) {this.boundingBoxButtonOn = true;}
    if (controlSettings.circleDrawer) {this.circleButton = true;}
    if (controlSettings.lineDrawer) {this.lineButton = true;}
    if (controlSettings.pointDrawer) {this.pointButton = true;}
    if (controlSettings.measureTool) {this.measureButton = true;}
    if (controlSettings.resizeGeometryButton) {this.resizeGeometryButton = true;}
    if (controlSettings.reshapeGeometryButton) {this.reshapeGeometryButton = true;}
    if (controlSettings.transformGeometryButton) {this.transformGeometryButton = true;}
    if (controlSettings.editCenterPointButton) {this.editCenterPointButton = true;}
    if (controlSettings.selectButton) {this.selectButtonOn = true;}
    if (controlSettings.rubberBandSelectButton) {this.rubberBandSelectButton = true;}
    if (controlSettings.homeButton) {this.homeButtonOn = true;}
    if (controlSettings.expandButton) {this.expandButtonOn = true;}
    if (controlSettings.downloadButton) {this.downloadButtonOn = true;}
    if (controlSettings.defaultControl) {this.defaultControl = controlSettings.defaultControl;}
    if (controlSettings.defaultLayerSwitcherBackgroundColor) {
      this.defaultLayerSwitcherBackgroundColor = controlSettings.defaultLayerSwitcherBackgroundColor;
    }
    if (controlSettings.defaultSelectStrokeColor) {
      this.defaultSelectStrokeColor = controlSettings.defaultSelectStrokeColor;
    }
    if (controlSettings.defaultSelectFillColor) {
      this.defaultSelectFillColor = controlSettings.defaultSelectFillColor;
    }
    if (controlSettings.boundingBoxDrawHandler) {
      this.boundingBoxDrawHandler = controlSettings.boundingBoxDrawHandler;
    }
    if (controlSettings.zoomEndHandler) {
      this.zoomEndHandler = controlSettings.zoomEndHandler;
    }
    if (controlSettings.selectHandler) {
      this.selectHandler = controlSettings.selectHandler;
    }
    if (controlSettings.unselectHandler) {
      this.unselectHandler = controlSettings.unselectHandler;
    }
    if (controlSettings.editHandler) {
      this.editHandler = controlSettings.editHandler;
    }
    if (controlSettings.measureHandler) {
      this.measureHandler = controlSettings.measureHandler;
    }
    if (controlSettings.expandHandler) {
      this.expandHandler = controlSettings.expandHandler;
    }
    if (controlSettings.decimalPlaces) {this.decimalPlaces = controlSettings.decimalPlaces;}
  }

  // create controls on map
  if (this.zoomBarOn) {this.zoomBar();}
  if (this.graticuleOn) {this.graticuleOption();}
  if (this.layerSwitcherOn) {this.layerSwitcher();}
  if (this.scaleLineOn) {this.scaleLine();}
  if (this.overviewMapOn) {this.overviewMap();}
  if (this.featureSearchOn) {this.featureSearch();}
  if (this.mousePositionOn) {this.mousePosition();}
  if (this.navButtonOn) {this.navigationButton();}
  if (this.homeButtonOn) {this.homeButton();}
  if (this.expandButtonOn) {this.expandButton();}
  if (this.selectButtonOn) {this.selectButton();}
  if (this.boundingBoxButtonOn) {this.boundingBoxButton();}
  if (this.downloadButtonOn) {this.downloadButton();}

};

//
//
AstroControls.prototype.activateButton = function(name) {

  var e=null;
  for (var i = 0; i < this.buttons.length; i++) {
    e = document.getElementById(this.buttons[i] + "Button");
    if ((this.buttons[i] == name) && (name != 'home') && (name != 'download')) {
      e.style.backgroundImage = 'url("' + this.imagePath + 'ol3buttons/' + name + '-hot.png")';
    } else {
      e.style.backgroundImage = 'url("' + this.imagePath + 'ol3buttons/' + this.buttons[i] + '.png")';
    }
  }
};


//
//
AstroControls.prototype.boundingBoxButton = function() {

  drawnFeatures = [];
  this.deactivateButtons();
  var this_ = this;
  var source = this_.astroMap.boundingBoxSource;
  source.on("addfeature", function(e) {
	      var index = drawnFeatures.indexOf(e.feature);
	      if (index > -1) {
		var format = new ol.format.WKT();
		var wkt = format.writeFeature(drawnFeatures[index], {decimals: 2});
		this_.astroMap.boundingBoxDrawer.drawFromControl(wkt);
	      }
  });
  var handlePolygon = function(e) {
    var features = new ol.Collection();
    this_.deactivateButtons();
    this_.activateButton("polygon");
    if (!this_.draw) {
      draw = new ol.interaction.Draw({
	       source: source,
	       type: "Polygon",
	       features: features
	       });
      this_.draw = draw;
      draw.on('drawstart', function(e) {
		source.clear();
		this_.astroMap.boundingBoxDrawer.removeAndUnstoreAll(false);
      });
      draw.on('drawend', function(e) {
		drawnFeatures.push(e.feature);
		this_.boundingBoxDrawHandler();
		//console.log(features);
      });
      this_.astroMap.map.addInteraction(draw);
    }
  };
  this.makeButton("polygon", handlePolygon, "Draw Bounding Box");
};

//
//
AstroControls.prototype.deactivateButtons = function() {

  if (this.draw) {
    this.astroMap.map.removeInteraction(this.draw);
    this.draw = null;
  }
  if (this.select) {
    this.astroMap.map.removeInteraction(this.select);
    this.select = null;
  }
  for (var i = 0; i < this.buttons.length; i++) {
    e = document.getElementById(this.buttons[i] + "Button");
    e.style.backgroundImage = 'url("' + this.imagePath + 'ol3buttons/' + this.buttons[i] + '.png")';
  }

};

//
AstroControls.prototype.downloadButton = function() {

  var this_ = this;
  var handleDownload = function(e) {

    if (this_.scaleline) {
      this_.astroMap.controls.scaleline.writeToCanvas();
    }

    //from stackoverflow
    function dataURLtoBlob(dataurl) {
      var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
      while(n--){u8arr[n] = bstr.charCodeAt(n);}
      return new Blob([u8arr], {type:mime});
    }

    this_.deactivateButtons();
    this_.activateButton("download");
    var canvas = document.getElementsByTagName('canvas')[0];
    anchor = document.getElementById("downloadAnchor");
    anchor.download = "astro-download.png";
    //anchor.href = canvas.toDataURL('image/png')
    var imgData = canvas.toDataURL('image/png');
    var blob = dataURLtoBlob(imgData);
    var objurl = URL.createObjectURL(blob);
    anchor.href = objurl;
  };
  this.makeButton("download", handleDownload, "Download Map");

};

//
AstroControls.prototype.expandButton = function() {

  var this_ = this;
  var handleExpand = function(e) {
    this_.deactivateButtons();
    this_.activateButton("expand");
    this_.astroMap.controls.expandHandler();
  };
  this.makeButton("expand", handleExpand, "Expand");

};

//
AstroControls.prototype.homeButton = function() {

  var this_ = this;
  var handleHome = function(e) {
    this_.deactivateButtons();
    this_.activateButton("home");
    this_.astroMap.home();
  };
  this.makeButton("home", handleHome, "Home");

};

//
AstroControls.prototype.layerSwitcher = function() {

  this.layerSwitcherOn = true;
  var this_ = this;
  var layerSwitcher = new ol.control.LayerSwitcher({
						     graticule: this_.graticuleOn,
						     astroMap: this_.astroMap,
						     tipLabel: 'Layers'
  });
  this.astroMap.map.addControl(layerSwitcher);

};


//
AstroControls.prototype.makeButton = function(name, handler, title) {

  this.buttons.push(name);
  var this_ = this;
  newControl = function(opt_options) {

    var options = opt_options || {};
    var anchor = document.createElement('a');
    anchor.href = '#' + name;
    anchor.id = name + 'Anchor';
    anchor.addEventListener('click', handler, false);
    anchor.addEventListener('touchstart', handler, false);

    var element = document.createElement('div');
    element.className = 'control ' + name + '-control ol-unselectable';
    element.id = name + "Button";
    element.style.backgroundImage = 'url("' + this_.imagePath + 'ol3buttons/' + name + '.png")';
    element.style.top = String(this_.buttonTop) + "px";
    element.setAttribute("title",title);
    this_.buttonTop += this_.buttonMargin;
    element.appendChild(anchor);
    ol.control.Control.call(this, {
			      element: element,
			      target: options.target
			    });
  };
  ol.inherits(newControl, ol.control.Control);
  this.astroMap.map.addControl(new newControl);
};

//
//
AstroControls.prototype.navigationButton = function() {

  var this_ = this;
  var handleNavigation = function(e) {
    this_.deactivateButtons();
    this_.activateButton("navigation");
  };
  this.makeButton("navigation", handleNavigation, "Navigate");

};

//
//
AstroControls.prototype.scaleLine = function() {
  this.scaleLineOn = true;

  var caxis = (this.astroMap.cAxisRadius * 1000);
  this.scaleline = new astro.ScaleLine();
  this.scaleline.setRadius(caxis);
  //hack to override render method - call updateElementAstro, not updateElement_
  this.scaleline.render = function(mapEvent) {
    var frameState = mapEvent.frameState;
    if (!frameState) {
      this.viewState_ = null;
    } else {
      this.viewState_ = frameState.viewState;
    }
    this.updateElementAstro();
   };
 this.astroMap.map.addControl(this.scaleline);
/*
 var this_ = this;
 this.astroMap.map.on('postcompose', function (evt) {
			this_.astroMap.controls.scaleline.writeToCanvas(evt);
 });
*/
};

//
//
AstroControls.prototype.selectButton = function() {

  this.deactivateButtons();
  var this_ = this;
  var handleSelect = function(e) {
    this_.deactivateButtons();
    this_.activateButton("select");
    this_.select = new ol.interaction.Select({
					       condition: ol.events.condition.click,
					       wrapX: false,
					       //layers: [this_.astroMap.vectorLayer, this_.astroMap.poiLayer]
					       layers: [this_.astroMap.vectorLayer]
					     });
    this_.astroMap.map.addInteraction(this_.select);
    this_.select.on('select', function(e) {
		      var selected = e.selected;
		      if (selected.length) {
			selected.forEach(function(feature){
			  this_.astroMap.controls.selectHandler(feature);
			});
		      }

		    });
  };
  this.makeButton("select", handleSelect, "Select Footprint");

};


//
AstroControls.prototype.toggleLayer = function(name) {
  var layerArray = this.astroMap.map.getLayersByName(name);
  if (layerArray.length > 0) {
    layerArray[0].display();
  }
};

//
// overview map
AstroControls.prototype.overviewMap = function() {
  this.overviewMapOn = true;
  this.astroMap.map.addControl(new ol.control.OverviewMap());
};


//
// graticule
AstroControls.prototype.graticuleOption = function() {
  this.graticuleOn = true;

  latStyle = new ol.style.Text({
    font: '12px Calibri,sans-serif',
    textBaseline: 'bottom',
    textAlign: 'end',
    fill: new ol.style.Fill({
      color: '#eee'
    })
  });

  var cordLabels = function(lon){
    return lon.toFixed(2);
  };
  var nullLabels = function(lon){
    return '';
  };

  if (this.astroMap.projection == "cylindrical") {
    //var graticule  = new AstroGraticule({
    this.graticule  = new ol.Graticule({
      // the style to use for the lines, optional.
					strokeStyle: new ol.style.Stroke({
					  width: .5,
					  color: "#fff"
					}),
					showLabels: true,
					lonLabelFormatter: cordLabels,
					latLabelFormatter: cordLabels,
					latLabelStyle: latStyle,
					lonLabelStyle: latStyle
					},
					this.astroMap.projection);
  } else {
    this.graticule  = new ol.Graticule({

					  // the style to use for the lines, optional.
					strokeStyle: new ol.style.Stroke({
					  width: .5,
					  color: "#fff"
					}),
					showLabels: true,
					lonLabelFormatter: nullLabels,
					latLabelFormatter: cordLabels,
					latLabelStyle: latStyle,
					lonLabelStyle: latStyle
					},
					this.astroMap.projection);

  }
  this.graticule.setMap(this.astroMap.map);
};

//
// feature search
// TODO finish this? or get rid of it...
AstroControls.prototype.featureSearch = function() {
  this.featureSearchOn = true;
  var featureSearchLayer = new OpenLayers.Layer.Vector("Feature Search");
  this.astroMap.map.addLayers([featureSearchLayer]);
  var featureSearch = new OpenLayers.Control.GetFeature({
    protocol: OpenLayers.Protocol.WFS({
      url: this.astroMap.nomenWFSURL,
      featureType: "Nomenclature",
      featureNS: "http://intraweb-dev/nomen"
    }),
    box: true,
    hover: false,
    multipleKey: "shiftKey",
    toggleKey: "ctrlKey"
  });

  this.astroMap.map.addControl(featureSearch);
  featureSearch.activate();

};

//
// add mouse lon/lat position to external div in console
AstroControls.prototype.mousePosition = function() {
  this.mousePositionOn = true;

  var mouseDiv = (this.astroMap.console) ? this.astroMap.console.mouseLonLatDiv : this.mouseLonLatDiv;
  if (document.getElementById(mouseDiv)) {
    document.getElementById(mouseDiv).innerHTML = '';
    var mousePositionControl = new ol.control.MousePosition({
							    coordinateFormat: function(coordinate) {
							      var londom = (document.getElementById('astroConsoleLonDomSelect'));
							      var londir = (document.getElementById('astroConsoleLonDirSelect'));
							      var lattype = (document.getElementById('astroConsoleLatTypeSelect'));
							      if (londir && londir.options[londir.selectedIndex].value == 'PositiveWest') {
								coordinate = AstroGeometry.transformPosEastPosWest(coordinate);
							      }
							      if (londom && londom.options[londom.selectedIndex].value == '180') {
								coordinate = AstroGeometry.transform0360To180180(coordinate);
							      }
							      if (londom && londom.options[lattype.selectedIndex].value == 'Plantographic') {
								coordinate = AstroGeometry.transformOcentricToOgraphic(coordinate);
							      }
							      return ol.coordinate.format(coordinate, '{y}, {x}', 2);
							    },
							    projection: this.astroMap.currentProj,
							    className: 'custom-mouse-position',
							    target: document.getElementById(mouseDiv),
							    undefinedHTML: '&nbsp;'
							  });
    this.astroMap.map.addControl(mousePositionControl);
  }
};

//
AstroControls.prototype.transformDecimalPlaces = function(point) {
  return(AstroGeometry.transformDecimalPlaces(point, astroMap.controls.decimalPlaces));
};


//
AstroControls.prototype.zoomBar = function() {
  this.zoomBarOn = true;
  var zoom = new ol.control.Zoom();
  this.astroMap.map.addControl(zoom);
};

/*
 * Helpers/AstroGeometry.js
 *
 * This utility class provides geometry helper methods (reprojections, dateline math, etc.).
 *
 * This class should never need to be instantiated because all methods may be called
 * statically. For example,
 *   AstroGeometry.saturatePointArray(...);
 *
 * Depends on OpenLayers.js
 */

// constructor
function AstroGeometry() {}

/*
 * Cleans up the WKT string by removing unnecessary whitespace from beginning and
 * end of string, as well as any whitespace between text and an opening parenthesis.
 *
 * For example, '  MULTIPOINT ((10 10), (45 45))  ' will become 'MULTIPOINT((10 10),(45 45))'.
 *
 * Parameter: wkt - the wkt string to be cleaned
 * Returns: the clean wkt string
 */
AstroGeometry.cleanWkt = function(wkt) {
  // trim
  wkt = wkt.replace(/^\s+|\s+$/g, "");

  // remove whitespace between geometry type and paren
  return wkt.replace(/\s+\(/g, "(");
};

/*
 * Extracts the geometry type from the WKT string. For example, if the WKT string is
 * 'POINT(7 10)', 'POINT' will be returned. Assumes the WKT has already been cleaned up
 * (see AstroGeometry.cleanWkt() for more details).
 *
 * Parameter: wkt - the wkt string
 * Returns: the geometry type string, or null if bad WKT
 */
AstroGeometry.extractGeometryType = function(wkt) {
  var prefixEnd = wkt.indexOf("(");
  if (prefixEnd == -1) {
    return null;
  }
  return wkt.substring(0, prefixEnd);
};

/*
 * Warps a geometry by adding extra points along the edges. Helps to maintain
 * shape on reprojections. Supported geometry types include POINT, MULTIPOINT,
 * POLYGON, MULTIPOLYGON, LINESTRING, MULTILINESTRING.
 *
 * IMPORTANT: Polygons and MultiPolygons containing holes (interior rings) are not supported.
 *
 * Parameter: wkt - wkt string (EPSG:4326)
 * Returns: warped wkt string
 */
AstroGeometry.warpWkt = function(wkt) {
  // extract the geometry type (prefix)
  var wktPrefix = this.extractGeometryType(wkt);

  //console.log('warp wkt ' + wkt);

  if ((wktPrefix == "POINT") || (wktPrefix == "MULTIPOINT")) {
    return wkt;
  }
  else if (wktPrefix == "POLYGON") {
    // extract points from wkt (ONLY WORKS FOR SIMPLE POLYGONS WITHOUT HOLES)
    var points = wkt.slice(9, wkt.length - 2).split(',');

    if (points.length <= 16) {
      var newPoints = this.saturatePointArray(points);
      // return warped wkt
      return "POLYGON((" + newPoints.join() + "))";
    }
    else {
      // we don't need to warp because there are too many points
      return wkt;
    }
  }
  else if (wktPrefix == "LINESTRING") {
    var points = wkt.slice(11, wkt.length - 1).split(',');

    if (points.length <= 16) {
      var newPoints = this.saturatePointArray(points);
      return "LINESTRING(" + newPoints.join() + ")";
    }
    else {
      return wkt;
    }
  }
  else if (wktPrefix == "MULTIPOLYGON") {
    // parse wkt
    var wktParser = new ol.format.WKT();
    var multiGeometry = wktParser.readGeometry(wkt);

    // grab individual polygons that comprise this geometry and warp them
    var polys = multiGeometry.getPolygons();
    var polyArray = [];

    for (var i = 0, len = polys.length; i < len; i++) {
      var points = polys[i].getCoordinates();
      var pointsF = [];
      points = points[0];
      for (var j = 0, pLen = points.length; j < pLen; j++) {
	pointsF[j] = points[j][0] + ' ' + points[j][1];
      }
      if (points.length <= 16) {
        var newPoints = this.saturatePointArray(pointsF);
        polyArray[i] = "((" + newPoints.join() + "))";
      } else {
        polyArray[i] = "((" + pointsF.join() + "))";
      }
    }
    return "MULTIPOLYGON(" + polyArray.join() + ")";
  }
  else if (wktPrefix == "MULTILINESTRING") {
    var wktParser = new OpenLayers.Format.WKT();
    var multiFeature = wktParser.read(wkt);

    var lines = multiFeature.getGeometry().components;
    var lineArray = [];
    for (var i = 0, len = lines.length; i < len; i++) {
      var linesStr = lines[i].toString();
      var points = linesStr.slice(11, linesStr.length - 1).split(',');

      if (points.length <= 16) {
        var newPoints = this.saturatePointArray(points);
        lineArray[i] = "(" + newPoints.join() + ")";
      }
      else {
        lineArray[i] = "(" + points.join() + ")";
      }
    }
    return "MULTILINESTRING(" + lineArray.join() + ")";
  }
  else {
    // unsupported geometry type, so just return it
    return wkt;
  }
};

/*
 * Fills an array of points, helps to maintain shapes on reprojections.
 *
 * Parameter: pointArray - array of points
 * Returns: wkt-ready string (without prefix)
 */
AstroGeometry.saturatePointArray = function(pointArray) {
  var newPointArray = [];
  var n = 0;

  for(var i = 0, len = (pointArray.length - 1); i < len; i++) {
    var latlon = pointArray[i].toString().replace(/^\s+|\s+$/g,'').split(' ');
    var nextlatlon = pointArray[i+1].toString().replace(/^\s+|\s+$/g,'').split(' ');
    var skipPoint = false;
    //dup points
    if ( (Number(latlon[0]) == Number(nextlatlon[0])) && (Number(latlon[1]) == Number(nextlatlon[1])) )    {
      skipPoint = true;
    }
    //line to pole
    if ( ((latlon[0] == 0) || (latlon[0] == 360)) && ((nextlatlon[0] == 0) || (nextlatlon[0] == 360)) )   {
      skipPoint = true;
    }
    if (skipPoint){
      newPointArray[n] = [pointArray[i]];
      n+=1;
      continue;
    }
    var midLon = (Number(latlon[0])+Number(nextlatlon[0]))/2;
    var midLat = (Number(latlon[1])+Number(nextlatlon[1]))/2;
    var qLon = (Number(latlon[0])+Number(midLon))/2;
    var qLat = (Number(latlon[1])+Number(midLat))/2;
    var qqqLon = (Number(nextlatlon[0])+Number(midLon))/2;
    var qqqLat = (Number(nextlatlon[1])+Number(midLat))/2;
    var eLon = (Number(latlon[0])+Number(qLon))/2;
    var eLat = (Number(latlon[1])+Number(qLat))/2;
    var eeeLon = (Number(midLon)+Number(qLon))/2;
    var eeeLat = (Number(midLat)+Number(qLat))/2;
    var eeeeeLon = (Number(midLon)+Number(qqqLon))/2;
    var eeeeeLat = (Number(midLat)+Number(qqqLat))/2;
    var eeeeeeeLon = (Number(nextlatlon[0])+Number(qqqLon))/2;
    var eeeeeeeLat = (Number(nextlatlon[1])+Number(qqqLat))/2;
    newPointArray[n] = [pointArray[i]];
    newPointArray[n+1] = [((Number(latlon[0])+eLon)/2)+' '+(Number(latlon[1])+eLat)/2];
    newPointArray[n+2] = [eLon+' '+eLat];
    newPointArray[n+3] = [((Number(qLon)+eLon)/2)+' '+(Number(qLat)+eLat)/2];
    newPointArray[n+4] = [qLon+' '+qLat];
    newPointArray[n+5] = [((Number(qLon)+eeeLon)/2)+' '+(Number(qLat)+eeeLat)/2];
    newPointArray[n+6] = [eeeLon+' '+eeeLat];
    newPointArray[n+7] = [((Number(midLon)+eeeLon)/2)+' '+(Number(midLat)+eeeLat)/2];
    newPointArray[n+8] = [midLon+' '+midLat];
    newPointArray[n+9] = [((Number(midLon)+eeeeeLon)/2)+' '+(Number(midLat)+eeeeeLat)/2];
    newPointArray[n+10] = [eeeeeLon+' '+eeeeeLat];
    newPointArray[n+11] = [((Number(qqqLon)+eeeeeLon)/2)+' '+(Number(qqqLat)+eeeeeLat)/2];
    newPointArray[n+12] = [qqqLon+' '+qqqLat];
    newPointArray[n+13] = [((Number(qqqLon)+eeeeeeeLon)/2)+' '+(Number(qqqLat)+eeeeeeeLat)/2];
    newPointArray[n+14] = [eeeeeeeLon+' '+eeeeeeeLat];
    newPointArray[n+15] = [((Number(nextlatlon[0])+eeeeeeeLon)/2)+' '+(Number(nextlatlon[1])+eeeeeeeLat)/2];
    n+=16;
  }
  newPointArray[n] = [pointArray[i]];
  return(newPointArray);
};

/*
 * Returns true if the wkt geometry crosses the dateline.
 *
 * Note: for points, this function will always return false. Points can lie ON
 * the dateline, but they cannot cross it.
 *
 * Parameters: wktString  - the geometry (always EPSG:4326)
 *             projection - the projection (string) of the map that the wkt will be drawn on
 * Returns: boolean
 */
AstroGeometry.crossesDateline = function(wktString, projection) {
  var crossingDateline = false;
  var format = new ol.format.WKT();
  var geometry = format.readGeometry(wktString);
  var ex = geometry.getExtent();

  //
  if (projection == "cylindrical") {
    var wktPrefix = this.extractGeometryType(wktString);

    if ((wktPrefix == "POLYGON") || (wktPrefix == "LINESTRING")) {

      var brX = ol.extent.getBottomRight(ex)[0];
      var blX = ol.extent.getBottomLeft(ex)[0];
      var maxX = Math.max (brX, blX);
      var minX = Math.min (brX, blX);
      //console.log('AG maxX ' + maxX + ' minX ' + minX);
      //console.log('AG crossesdateline wkt ' + wktString);

      //bounds rule
      if ( ((maxX > 360) && (minX < 360)) || ((minX < 0) && (maxX > 0)) ) {
	crossingDateline = true;
      } else if (minX > maxX) {
	//left-most-least rule (if undangled)
	//crossingDateline = true; (not using, inconsistent with OL bounds)
      }
    }
    else if (wktPrefix == "MULTIPOLYGON") { //|| (wktPrefix == "MULTILINESTRING")) {
      // check each geometry in multi geometry
      var polys = geometry.getPolygons();
      var leftSplit = false;
      var rightSplit = false;
      for (var i = 0, len = polys.length; i < len; i++) {
        var childWkt = format.writeGeometry(polys[i]);

	if (this.crossesDateline(childWkt, projection)) {
	    crossingDateline = true;
	  break;
	}
        //check for clean splits on dateline
	var childBounds = polys[i].getExtent();
	if (Number(ol.extent.getBottomLeft(childBounds)[0]) == 0) {
	  leftSplit = true;
	}
	if (Number(ol.extent.getBottomRight(childBounds)[0]) == 360) {
	  rightSplit = true;
	}

      }//for
      if (leftSplit && rightSplit) {
	crossingDateline = true;
      }
    }
    else if ((wktPrefix == "POINT") || (wktPrefix == "MULTIPOINT")) {
      return false;
    }
    else {
      // we should never get here...
      return false;
    }

  } else {
    //polar
    if (projection == "north-polar stereographic") {
      geometryP = geometry.transform('EPSG:4326','EPSG:32661');
    } else {
      geometryP = geometry.transform('EPSG:4326','EPSG:32761');
    }
    var exP = geometryP.getExtent();
    // create dateline
    var points = (projection == 'north-polar stereographic') ? [[0, 0],[0, -2357032]] : [[0, 0],[0, 2357032]];
    var dateline = new ol.geom.LineString(points);
    crossingDateline = dateline.intersectsExtent(exP);
  }

  return crossingDateline;
};

/*
 * Splits a geometry on the dateline if it needs to be split.
 *
 * Turns geometry into MULTI*. If a MULTI* is passed in, each
 * geometry within the multi will be split (if necessary) and a
 * MULTI* will still be returned.
 *
 * If no splitting is necessary for the supplied geometry, the
 * original WKT is returned, unchanged. If the geometry is a
 * MULTIPOINT or POINT, the original WKT is returned.
 *
 * Parameters: wktString  - WKT of geometry (0-360, EPSG:4326)
 *             projection - projection string (to projection)
 * Returns: MULTI* WKT (EPSG:4326) of split geometry
 */
AstroGeometry.splitOnDateline = function(wktString, projection) {
  var wktPrefix = this.extractGeometryType(wktString);
  var wktParse = new ol.format.WKT();
  var geometry = wktParse.readGeometry(wktString);
  var childWkt, splitWkt, splitPrefix, splitGeo = '';
  var childComponents = [];

  if ((wktPrefix == "MULTIPOLYGON") || (wktPrefix == "MULTILINESTRING")) {
    // check each of the geometries within multi geometry
    var polys = geometry.getPolygons();
    var newGeometry = (wktPrefix == "MULTIPOLYGON") ? new ol.geom.MultiPolygon : new ol.geom.MultiLineString;
    for (var i = 0, len = polys.length; i < len; i++) {
      childWkt = wktParse.writeGeometry(polys[i]);
      splitWkt = this.splitOnDateline(childWkt, projection);
      splitGeo = wktParse.readGeometry(splitWkt);
      splitPrefix = this.extractGeometryType(splitWkt);
      if ((splitPrefix == 'POLYGON') || (splitPrefix == 'LINESTRING')) {
	childComponents[0] = splitGeo;
      } else {
	childComponents = (wktPrefix == "MULTIPOLYGON") ? splitGeo.getPolygons() : splitGeo.getLineStrings();
      }
      for (var j = 0, innerLen = childComponents.length; j < innerLen; j++) {
	if (wktPrefix == "MULTIPOLYGON") {
	  newGeometry.appendPolygon(childComponents[j]);
	} else {
	  newGeometry.appendLineString(childComponents[j]);
	}
      }
    }
    return (wktParse.writeGeometry(newGeometry));
  }

  if (wktPrefix == "POLYGON") {

    //undangle
    wktString = this.undangle(wktString);

    // ONLY WORKS FOR SIMPLE POLYGONS THAT SPAN LESS THAN 180 DEGREES!
    //var geojson = new OpenLayers.Format.GeoJSON();
    var geojson = new ol.format.GeoJSON();
    var f = wktParse.readFeature(wktString);
    var featureJson = geojson.writeFeature(f);
    //console.log('json ' + featureJson);
    var featureArray = eval('('+featureJson+')');
    var coordinates = featureArray.geometry.coordinates.toString().split(",");
    var poly = {1:'',2:''};
    var polyNum = 1;
    var polyRingPoint = [];
    var pollLatLon = [];
    var datelineCrosses = 0;
    var poly1HighLon = true;


    // loop through array of coordinates
    for(var i = 0, len = coordinates.length; i < len; i = i+2) {
      var lon = coordinates[i];
      var lat = coordinates[i+1];
      var nextLon = coordinates[i+2];
      var nextLat = coordinates[i+3];
      //jumps to poll at dateline mean pole-containing split already happened
      if ( ((lat == 90) && (nextLat == 90)) || ((lat == -90) && (nextLat == -90)) ) {
	if ( ((lon == 360) && (nextLon == 0)) || ((lon == 0) && (nextLon == 360)) || ((lon == 720) && (nextLon == 360)) || ((lon == 0) && (nextLon == -360)) ) {
	  return wktString;
	}
      }

      // store first ring point
      if (i==0) {polyRingPoint[polyNum] = ','+lon+' '+lat;}

      // WARNING - for this to work, polygons must span less than 180 degrees!!
      if (((nextLon - lon) > 180) || ((nextLon - lon) < -180)) {
        datelineCrosses += 1;
        // polygon moves from 360 to 0 degrees - find lat where it hits dateline:
        var newLat;
        if (projection != "cylindrical") {
          var equationLat = (((nextLon-lon) * (lat-90)) - ((nextLat-lat)*lon)) / (-180 * (nextLon-lon));
          newLat = (Number(lat) + Number(equationLat * (nextLat - lat)));
        }
        else {
          // make sure lat/lons are numbers, not strings
          lat = lat / 1;
          lon = lon / 1;
          nextLat = nextLat / 1;
          nextLon = nextLon / 1;

          // find slope of line segment. lon offset depends on which side
          // of the dateline we are on. We add 360 to the smaller of the
          // two lons so that there isn't a 'wrap' from 360 back to 0.
          // Once we've found the slope, we use point-slope form to determine
          // the lat of where the line segment hits the dateline.

          // figure out which side of the dateline we are on
          // (left -> right, or right -> left)
          if (lon > nextLon) {
            // we are crossing from left to right (ex. 357 to 3):
            // add 360 to the next longitude as it is smaller than the current lon,
            // and needs to be greater than 360 (this avoids the wrap back to 0)
            var slope = ((nextLat - lat) / ((360 + nextLon) - lon));

            // calculate lat of where the line segment connecting the two points
            // hits the dateline using point-slope form
            newLat = (lat + (slope * (360 - lon)));
          }
          else {
            // we are crossing from right to left (ex. 357 to 3):
            // current lon is smaller than next lon, so add 360 to it
            // to make it greater than 360 and avoid the 'wrap'
            var slope = ((nextLat - lat) / (nextLon - (360 + lon)));
            newLat = (lat + (slope * (360 - (360 + lon))));
          }
        }

        // add current point
        if (poly[polyNum]) {poly[polyNum] = poly[polyNum]+',';}
        poly[polyNum] = poly[polyNum]+lon+' '+lat;

        // toggle polygon.. change dateline...
        if (poly[polyNum]) {poly[polyNum] = poly[polyNum]+',';}
        if ((nextLon-lon) > 180)  {
          datelineLon= 0;
          poly[polyNum] = poly[polyNum]+datelineLon+' '+newLat;
          pollLatLon = (projection == 'north-polar stereographic') ? {1:',0 90',2:',360 90'} : {1:',0 -90',2:',360 -90'};
          polyNum = (polyNum == 1) ? 2 : 1; // switch sides
        }
        if ((nextLon -lon) < -180) {
          datelineLon= 360;
          poly[polyNum] = poly[polyNum]+datelineLon+' '+newLat;
          pollLatLon = (projection == 'north-polar stereographic') ? {2:',0 90',1:',360 90'} : {2:',0 -90',1:',360 -90'};
          if (polyNum == 1) {
            polyNum =  2;
          }
          else {
            polyNum =  1;
            poly1HighLon = false;
          }
        }

        // add dateline point for toggled polygon
        datelineLon= (datelineLon == 360) ? 0 : 360;
        if (poly[polyNum]) {poly[polyNum] = poly[polyNum]+',';}
        poly[polyNum] = poly[polyNum]+datelineLon+' '+newLat;

        // record end ring point (for second poly that starts on dateline)
        polyRingPoint[polyNum] = ','+datelineLon+' '+newLat;
      }
      else {
        // just push point
        if (poly[polyNum]) {poly[polyNum] = poly[polyNum]+',';}
        poly[polyNum] = poly[polyNum]+lon+' '+lat;
      }
    } // for loop

    // make multipolygon
    if (!poly[2]) { //no second poly made...use poly 1
      return('MULTIPOLYGON((('+poly[1]+')))');
    } else if (datelineCrosses == 1) { //dateline crossed once, combine polys
      // combine polys
      poly[1] += pollLatLon[1] + pollLatLon[2] + ',' +poly[2];
      return('MULTIPOLYGON((('+poly[1]+')))');
    }
    else {
      // close second polygon
      poly[2] += polyRingPoint[2];
      return('MULTIPOLYGON((('+poly[1]+')),(('+poly[2]+')))');
    }
  }
  else if (wktPrefix == "LINESTRING") {
    // return original wkt if it doesn't cross the dateline
    if (!this.crossesDateline(wktString, projection)) {
      return wktString;
    }

    // ONLY WORKS FOR SIMPLE LINESTRINGS THAT SPAN LESS THAN 180 DEGREES!
    var geojson = new OpenLayers.Format.GeoJSON();
    var featureJson = geojson.write(wktParse.read(wktString));
    var featureArray = eval('('+featureJson+')');
    var coordinates = featureArray.geometry.coordinates.toString().split(",");

    // build 'normalized' wkt where dateline crosses don't stay within 0-360
    var normalizedWktArrayStr = [];  // use an array to concat strings for better performance
    normalizedWktArrayStr.push("LINESTRING(");

    // loop through array of coordinates
    var added = false;  // was the previous point normalized and added already?
    for(i = 0, len = coordinates.length; i < len; i = i+2) {
      var lon = coordinates[i];
      var lat = coordinates[i+1];
      var nextLon = coordinates[i+2];
      var nextLat = coordinates[i+3];

      // WARNING - for this to work, linestrings must span less than 180 degrees!!
      if (((nextLon - lon) > 180) || ((nextLon - lon) < -180)) {
        // figure out which side of the dateline we are on
        // (left -> right, or right -> left)
        if (lon > nextLon) {
          // we are crossing from left to right (ex. 357 to 3)
          // add current point and shift next lon before adding it too
          normalizedWktArrayStr.push(lon + ' ' + lat + ",");
          normalizedWktArrayStr.push((360 + (nextLon / 1)) + ' ' + nextLat + ",");
        }
        else {
          // shift current lon and add next lon
          normalizedWktArrayStr.push((360 + (lon / 1)) + ' ' + lat + ",");
          normalizedWktArrayStr.push(nextLon + ' ' + nextLat + ",");
        }
        added = true;
      }
      else {
        if (!added) {
          normalizedWktArrayStr.push(lon + ' ' + lat + ",");
        }
        added = false;
      }
    }

    // finish normalized wkt
    var normalizedWkt = normalizedWktArrayStr.join("");  // create string
    normalizedWkt = normalizedWkt.substring(0, normalizedWkt.length - 1);
    normalizedWkt += ")";

    // split the linestring using OL's split function (only works for linestrings)
    var featureGeometry = wktParse.read(normalizedWkt).geometry;
    var datelineFeatureGeometry = wktParse.read("LINESTRING(360 -90, 360 90)").geometry;

    var splitGeos = featureGeometry.splitWith(datelineFeatureGeometry);
    var splitGeometry = new OpenLayers.Geometry.MultiLineString(splitGeos);
    var splitFeature = new OpenLayers.Feature.Vector(splitGeometry);

    return wktParse.write(splitFeature);
  }
  else {
    // we never need to split points, so just return the original wkt unchanged
    return wktString;
  }
};

/*
 * Adds dateline-shifted geometries to the supplied WKT.
 *
 * This is necessary for OL to correctly render both sides of a
 * split vector crossing the dateline. The supplied WKT
 * should have already been split on the dateline. This function
 * only needs to be called when rendering geometries in
 * cylindrical projection.
 *
 * Parameters: wkt - the geometry (always EPSG:4326)
 * Returns: wkt string with added extra dateline-shifted geometries
 */
AstroGeometry.datelineShift = function(wkt) {

  var wktParser = new ol.format.WKT();
  var geometry = wktParser.readGeometry(wkt);
  var wktPrefix = this.extractGeometryType(wkt);

  var shiftProjection = new ol.proj.Projection({
      code: 'shift',
      units: 'degrees'
  });
  ol.proj.addProjection(shiftProjection);
  ol.proj.addCoordinateTransforms('EPSG:4326', 'shift',
				  function(coordinate) {
				    return AstroGeometry.transformDatelineShift(coordinate);
				  },
				  function(coordinate) {
				    return AstroGeometry.transformDatelineUnShift(coordinate);
				  });

    var geometries = [];
    switch (wktPrefix) {
      case "POLYGON":
      case "MULTIPOLYGON":
	if (wktPrefix == "MULTIPOLYGON") {
	  geometries = geometry.getPolygons();
	} else {
	  geometries[0] = geometry;
	}
	shiftedGeometry = new ol.geom.MultiPolygon();
	pushFX = 'appendPolygon';
	break;
      case "LINESTRING":
      case "MULTILINESTRING":
	if (wktPrefix == "MULTILINESTRING") {
	  geometries = geometry.getLineStrings();
	} else {
	  geometries[0] = geometry;
	}
	shiftedGeometry = new ol.geom.MultiLineString();
	pushFX = 'appendLineString';
	break;
      case "POINT":
      case "MULTIPOINT":
	if (wktPrefix == "MULTIPOINT") {
	  geometries = geometry.getPoints();
	} else {
	  geometries[0] = geometry;
	}
      	shiftedGeometry = new ol.geom.MultiPoint();
	pushFX = 'appendPoint';
      break;
    }

    // loop through each geometry and shift it
    var newGeometries = [];
    for (var i = 0, len = geometries.length; i < len; i++) {
      var copy1 = geometries[i].clone();
      var copy2 = geometries[i].clone();
      newGeometries.push(geometries[i]);  // original
      shiftedGeometry[pushFX](geometries[i]);

      copy1 = copy1.transform('EPSG:4326','shift');
      newGeometries.push(copy1);
      shiftedGeometry[pushFX](copy1);
      copy2 = copy2.transform('shift', 'EPSG:4326');
      newGeometries.push(copy2);
      shiftedGeometry[pushFX](copy2);
    }
    shiftedWKT = wktParser.writeGeometry(shiftedGeometry);
    return shiftedWKT;
};

// get rid of lon >0 and <360
AstroGeometry.undangle = function(wkt) {

  var format = new ol.format.WKT();
  var geometry = format.readGeometry(wkt);
  geometry = geometry.transform('EPSG:4326','undangle');
  wkt = format.writeGeometry(geometry);
  return wkt;
};

//
// TRANSFORM FUNCTIONS
//
AstroGeometry.transformCylindricalToLatLon = function(point) {
  return(point);
};

AstroGeometry.transformLatLonToCylindrical = function(point) {
  return(point);
};

AstroGeometry.transformTruncate = function(point) {
  var amt = 2;
  point[0] = point[0].toFixed(amt);
  point[1] = point[1].toFixed(amt);
  return(point);
};

AstroGeometry.transformPolarMetersToLatLon = function(point, projection, caxisradius) {
  var R = (caxisradius * 1000);
  var clat;
  var lonRadians;
  var x = point[0];
  var y = point[1];

  switch (projection) {
    case 'north-polar stereographic':
      clat = 90;
      lonRadians = Math.atan2(x, -y);
      break;
    case 'south-polar stereographic':
      clat = -90;
      lonRadians = Math.atan2(x, y);
      break;
  }

  // Compute LAT
  var clatRadians = clat * (Math.PI/180);
  var p = Math.sqrt(Math.pow(x,2) + Math.pow(y,2));
  var c = 2 * Math.atan(p/(2 * R));
  var latRadians = Math.asin(Math.cos(c) * Math.sin(clatRadians)); //+ (point.y * Math.sin(c) * Math.cos(clatRadians)/p));
  var lat = latRadians * 180/Math.PI;

  // Compute LON
  var lon = lonRadians * 180/Math.PI;
  if (lon < 0) {
    lon = lon + 360;
  }
  point[0] = lon;
  point[1] = lat;

  return point;
};

AstroGeometry.transformLatLonToPolarMeters = function(point, projection, caxisradius) {
 // console.log(point);
  var R = (caxisradius * 1000);
  var x = point[0];
  var y = point[1];
  var lonRadians = (x) * Math.PI / 180;
  var latRadians = (y) * Math.PI / 180;

  if (projection == 'north-polar stereographic') {
    point[0] = (2 * R * Math.tan(Math.PI / 4 - latRadians / 2) * Math.sin(lonRadians));
    point[1] = (-2 * R * Math.tan(Math.PI / 4 - latRadians / 2) * Math.cos(lonRadians));
  } else {
    point[0] = 2 * R * Math.tan (Math.PI / 4 + latRadians / 2) * Math.sin(lonRadians);
    point[1] = 2 * R * Math.tan (Math.PI / 4 + latRadians / 2) * Math.cos(lonRadians);
  }
//  console.log(point);
  return point;
};

AstroGeometry.transform180180To0360 = function(point) {
  var x = point[0];
  if (x < 0) {point[0] = x + 360;}
  return point;
};

AstroGeometry.transform0360To180180 = function(point) {
  var x = point[0];
  if (x > 180) {point[0] = x - 360;}
  return point;
};

AstroGeometry.transformDatelineShift = function(point) {
  point[0] = point[0] + 360;
  return point;
};

AstroGeometry.transformDatelineUnShift = function(point) {
    point[0] = point[0] - 360;
    return point;
};

AstroGeometry.transformDanglers = function(point) {
  var x = point[0];
  while (x < 0) {x = x + 360;}
  while (x > 360) {x = x - 360;}
  point[0] = x;
  return point;
};


// no reversal - works both ways
AstroGeometry.transformPosEastPosWest = function(point) {
    point[0] = 360 - point[0];
    return point;
};

AstroGeometry.transformOcentricToOgraphic = function(point, aaxisradius, caxisradius) {
  var newY = point[1] * Math.PI / 180;
  newY = Math.atan(Math.tan(newY) * (aaxisradius / caxisradius) * (aaxisradius / caxisradius));
  newY = newY * 180 / Math.PI;
  point[1] = newY;
  return point;
};

AstroGeometry.transformOgraphicToOcentric = function(point, aaxisradius, caxisradius) {
  var newY = point[1] * Math.PI / 180;
  newY = Math.atan(Math.tan(newY) * (caxisradius / aaxisradius) * (caxisradius / aaxisradius));
  newY = newY * 180 / Math.PI;
  point[1] = newY;
  return point;
};

AstroGeometry.transformDecimalPlaces = function(point, places) {
  if (!places) { places = 2;}
  point.x = Number(point.x).toFixed(places);
  point.y = Number(point.y).toFixed(places);
  return point;
};

// Vincenty Inverse Formula - translated to js by Chris Veness 2002-2011
AstroGeometry.LatLonToKM = function(lat1, lon1, lat2, lon2, aaxisradius, caxisradius) {

  if (typeof(Number.prototype.toRad) === "undefined") {
    Number.prototype.toRad = function() {return(this * Math.PI / 180);};
  }

  var a = aaxisradius; b = caxisradius;
  var f = 0; //(a - b) / a;
  var L = (lon2-lon1).toRad();
  var U1 = Math.atan((1-f) * Math.tan(lat1.toRad()));
  var U2 = Math.atan((1-f) * Math.tan(lat2.toRad()));
  var sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
  var sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

  var lambda = L, lambdaP, iterLimit = 100;
    do {
      var sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda);
      var sinSigma = Math.sqrt((cosU2*sinLambda) * (cosU2*sinLambda) +
			       (cosU1*sinU2-sinU1*cosU2*cosLambda) * (cosU1*sinU2-sinU1*cosU2*cosLambda));
      if (sinSigma==0) return 0;  // co-incident points
      var cosSigma = sinU1*sinU2 + cosU1*cosU2*cosLambda;
      var sigma = Math.atan2(sinSigma, cosSigma);
      var sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
      var cosSqAlpha = 1 - sinAlpha*sinAlpha;
      var cos2SigmaM = cosSigma - 2*sinU1*sinU2/cosSqAlpha;
      if (isNaN(cos2SigmaM)) cos2SigmaM = 0;  // equatorial line: cosSqAlpha=0
      var C = f/16*cosSqAlpha*(4+f*(4-3*cosSqAlpha));
      lambdaP = lambda;
      lambda = L + (1-C) * f * sinAlpha *
	(sigma + C*sinSigma*(cos2SigmaM+C*cosSigma*(-1+2*cos2SigmaM*cos2SigmaM)));
    } while (Math.abs(lambda-lambdaP) > 1e-12 && --iterLimit>0);

  if (iterLimit==0) return NaN;  // formula failed to converge

  var uSq = cosSqAlpha * (a*a - b*b) / (b*b);
  var A = 1 + uSq/16384*(4096+uSq*(-768+uSq*(320-175*uSq)));
  var B = uSq/1024 * (256+uSq*(-128+uSq*(74-47*uSq)));
  var deltaSigma = B*sinSigma*(cos2SigmaM+B/4*(cosSigma*(-1+2*cos2SigmaM*cos2SigmaM)-
					       B/6*cos2SigmaM*(-3+4*sinSigma*sinSigma)*(-3+4*cos2SigmaM*cos2SigmaM)));
  var s = b*A*(sigma-deltaSigma);

  s = s.toFixed(3); // round to 1mm precision
  return s;

};

//
//TODO - make work with multi-line
AstroGeometry.getLengthOfLine = function(geometry, aAxisRadius, cAxisRadius, projection) {
  var length = 0;
  var newGeometry = geometry;
  if ((projection == 'north-polar stereographic') || (projection == 'south-polar stereographic')) {
    var wktParseR = new OpenLayers.Format.WKT();
    wktParseR.internalProjection = new OpenLayers.Projection("EPSG:4326");
    wktParseR.externalProjection = new OpenLayers.Projection(projection);
    newGeometry = wktParseR.read(geometry.toString()).geometry;
  }
  var lineStringArray = newGeometry.getVertices();
  var currentPoint, nextPoint;
  if (lineStringArray.length > 1) {
    for (var i=0; i < (lineStringArray.length -1); i++) {
      currentPoint = lineStringArray[i];
      nextPoint = lineStringArray[i + 1];
      length = (length + Number(this.LatLonToKM(currentPoint.y, currentPoint.x, nextPoint.y, nextPoint.x, aAxisRadius, cAxisRadius)));
    }
  }
  return length;
};


//
AstroGeometry.getAreaOfPolygon = function(polyGeometry, aAxisRadius, cAxisRadius, projection) {


  if (projection == 'cylindrical') {
      var wktParse = new OpenLayers.Format.WKT();
      wktParse.internalProjection = new OpenLayers.Projection("north-polar-stereographic");
      wktParse.externalProjection = new OpenLayers.Projection("EPSG:4326");
      newGeometry = wktParse.read(polyGeometry.toString()).geometry;
    }
  //console.log('meters geo ' + newGeometry.toString());

  /*
    var coordinates = polyGeometry.coordinates.toString().split(",");
    for(i = 0, len = coordinates.length; i < len; i = i+2) {
      var lon = coordinates[i];
      var lat = coordinates[i+1];
    }

    var area = 0;         // Accumulates area in the loop
    j = numPoints-1;  // The last vertex is the 'previous' one to the first

    for (i=0; i<numPoints; i++) {
      area = area +  (X[j]+X[i]) * (Y[j]-Y[i]);
      j = i;  //j is previous vertex to i
    }
    return area/2;
*/
};


//
// http://forum.worldwindcentral.com/showthread.php?20724-A-method-to-compute-the-area-of-a-spherical-polygon
//
AstroGeometry.getSphericalAreaOfPolygon = function(polyGeometry, radius) {

  var haversine = function(x) {
    return ( 1.0 - Math.Cos( x ) ) / 2.0;
  };

  var lam1 = 0, lam2 = 0, beta1 =0, beta2 = 0, cosB1 =0, cosB2 = 0;
  var hav = 0;
  var sum = 0;

  for(var j = 0 ; j < lat.Length ; j++ ) {
    var k = j + 1;

    if ( j == 0 ) {
      lam1 = lon[j];
      beta1 = lat[j];
      lam2 = lon[j + 1];
      beta2 = lat[j + 1];
      cosB1 = Math.Cos( beta1 );
      cosB2 = Math.Cos( beta2 );
    } else {
      k = ( j + 1 ) % lat.Length;
      lam1 = lam2;
      beta1 = beta2;
      lam2 = lon[k];
      beta2 = lat[k];
      cosB1 = cosB2;
      cosB2 = Math.Cos( beta2 );
    }

    if( lam1 != lam2 ) {

      hav = haversine( beta2 - beta1 ) +
	cosB1 * cosB2 * haversine( lam2 - lam1 );
      var a = 2 * Math.Asin( Math.Sqrt( hav ) );
      var b = Math.PI / 2 - beta2;
      var c = Math.PI / 2 - beta1;
      var s = 0.5 * ( a + b + c );
      var t = Math.Tan( s / 2 ) * Math.Tan( ( s - a ) / 2 ) *
	Math.Tan( ( s - b ) / 2 ) * Math.Tan( ( s - c ) / 2 );
      var excess = Math.Abs( 4 * Math.Atan( Math.Sqrt(Math.Abs( t ) ) ) );

      if( lam2 < lam1 ) {
	excess = -excess;
      }

      sum += excess;
    }
  }
  return(Math.Abs( sum ) * r * r);

};
/*
 * Hacked version of OL4 scaleline.  Handles variable radii.
 */

//namespace
window.astro = {};
var astro = window.astro;


// constructor -  inheriting methods from ol.control.ScaleLine
astro.ScaleLine = function() {

  this.minWidth_ = 64;
  this.caxis = 0;
  this.LEADING_DIGITS = [1, 2, 5];
  ol.control.ScaleLine.call(this);
  var options = {};
  var className = 'ol-scale-line';
  this.element = document.createElement("div");
  this.element.className = className;
  this.element.className += ' ol-unselectable';
  this.innerElement_ = document.createElement("div");
  this.innerElement_.className = className + '-inner';
  this.element.appendChild(this.innerElement_);
};
ol.inherits(astro.ScaleLine, ol.control.ScaleLine);

//missing from ol.js
ol.control.ScaleLineUnits = {
  DEGREES: 'degrees',
  IMPERIAL: 'imperial',
  NAUTICAL: 'nautical',
  METRIC: 'metric',
  US: 'us'
};
ol.control.ScaleLine.LEADING_DIGITS = [1, 2, 5];


// new updateElement
//ol.control.ScaleLine.prototype.updateElement_ = function() {
astro.ScaleLine.prototype.updateElementAstro = function() {
  var viewState = this.viewState_;

  if (!viewState) {
    if (this.renderedVisible_) {
      this.element_.style.display = 'none';
      this.renderedVisible_ = false;
    }
    return;
  }

  var center = viewState.center;
  var projection = viewState.projection;
  var units = this.getUnits();
  var projectionUnits = projection.getUnits();
  //var pointResolutionUnits = units == ol.control.ScaleLineUnits.DEGREES ?
  //  ol.proj.Units.DEGREES :
  //  ol.proj.Units.METERS;
  // var pointResolution = ol.proj.getPointResolution(projection, viewState.resolution, center, pointResolutionUnits);
   pointResolution = viewState.resolution;
  if (projectionUnits != 'degrees') {
    pointResolution *= projection.getMetersPerUnit();
  } else {
    cosLatitude = Math.cos(this.toRadians(center[1]));
    pointResolution *= Math.PI * cosLatitude * this.caxis / 180;
  }

  var nominalCount = this.minWidth_ * pointResolution;
  var suffix = '';
  if (units == ol.control.ScaleLineUnits.DEGREES) {
    var metersPerDegree = ol.proj.METERS_PER_UNIT[ol.proj.Units.DEGREES];
    if (projection.getUnits() == ol.proj.Units.DEGREES) {
      nominalCount *= metersPerDegree;
    } else {
      pointResolution /= metersPerDegree;
    }
    if (nominalCount < metersPerDegree / 60) {
      suffix = '\u2033'; // seconds
      pointResolution *= 3600;
    } else if (nominalCount < metersPerDegree) {
      suffix = '\u2032'; // minutes
      pointResolution *= 60;
    } else {
      suffix = '\u00b0'; // degrees
    }
  } else if (units == ol.control.ScaleLineUnits.IMPERIAL) {
    if (nominalCount < 0.9144) {
      suffix = 'in';
      pointResolution /= 0.0254;
    } else if (nominalCount < 1609.344) {
      suffix = 'ft';
      pointResolution /= 0.3048;
    } else {
      suffix = 'mi';
      pointResolution /= 1609.344;
    }
  } else if (units == ol.control.ScaleLineUnits.NAUTICAL) {
    pointResolution /= 1852;
    suffix = 'nm';
  } else if (units == ol.control.ScaleLineUnits.METRIC) {
    if (nominalCount < 0.001) {
      suffix = 'μm';
      pointResolution *= 1000000;
    } else if (nominalCount < 1) {
      suffix = 'mm';
      pointResolution *= 1000;
    } else if (nominalCount < 1000) {
      suffix = 'm';
    } else {
      suffix = 'km';
      pointResolution /= 1000;
    }
  } else if (units == ol.control.ScaleLineUnits.US) {
    if (nominalCount < 0.9144) {
      suffix = 'in';
      pointResolution *= 39.37;
    } else if (nominalCount < 1609.344) {
      suffix = 'ft';
      pointResolution /= 0.30480061;
    } else {
      suffix = 'mi';
      pointResolution /= 1609.3472;
    }
  } else {
    ol.asserts.assert(false, 33); // Invalid units
  }

  var i = 3 * Math.floor(
      Math.log(this.minWidth_ * pointResolution) / Math.log(10));
  var count, width;
  while (true) {
    count = ol.control.ScaleLine.LEADING_DIGITS[((i % 3) + 3) % 3] *
        Math.pow(10, Math.floor(i / 3));
    width = Math.round(count / pointResolution);
    if (isNaN(width)) {
      this.element_.style.display = 'none';
      this.renderedVisible_ = false;
      return;
    } else if (width >= this.minWidth_) {
      break;
    }
    ++i;
  }

  var html = count + ' ' + suffix;
  if (this.renderedHTML_ != html) {
    this.innerElement_.innerHTML = html;
    this.renderedHTML_ = html;
  }

  if (this.renderedWidth_ != width) {
    this.innerElement_.style.width = width + 'px';
    this.renderedWidth_ = width;
  }

  if (!this.renderedVisible_ && this.element_) {
    this.element_.style.display = '';
    this.renderedVisible_ = true;
  }

};

//
astro.ScaleLine.prototype.setRadius = function(caxis) {
  this.caxis = caxis;
};

//
astro.ScaleLine.prototype.toRadians = function(Value) {
  return Value * Math.PI / 180;
};

//https://www.kreidefossilien.de/webgis/dokumentation/beispiele/export-map-to-png-with-scale
astro.ScaleLine.prototype.writeToCanvas = function() {

  //get the canvas element
  var canvas = $('canvas').get(0);
  //get the Scaleline div container the style-width property
  var olscale = $('.ol-scale-line-inner');
  //Scaleline thicknes
  var line1 = 6;
  //Offset from the left
  var x_offset = 10;
  //offset from the bottom
  var y_offset = 30;
  var fontsize1 = 15;
    var font1 = fontsize1 + 'px Arial';
  // how big should the scale be (original css-width multiplied)
  var multiplier = 1;

  //var ctx = e.context;
  var ctx = canvas.getContext('2d');
  //var ctx = e.context;
  var scalewidth = parseInt(olscale.css('width'),10)*multiplier;
  var scale = olscale.text();
  var scalenumber = parseInt(scale,10)*multiplier;
  var scaleunit = scale.match(/[Aa-zZ]{1,}/g);

  //Scale Text
  ctx.beginPath();
  ctx.textAlign = "left";
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#000000";
  ctx.lineWidth = 5;
  ctx.font = font1;
  ctx.strokeText([scalenumber + ' ' + scaleunit], x_offset + fontsize1 / 2, canvas.height - y_offset - fontsize1 / 2);
  ctx.fillText([scalenumber + ' ' + scaleunit], x_offset + fontsize1 / 2, canvas.height - y_offset - fontsize1 / 2);

  //Scale Dimensions
  var xzero = scalewidth + x_offset;
  var yzero = canvas.height - y_offset;
  var xfirst = x_offset + scalewidth * 1 / 4;
  var xsecond = xfirst + scalewidth * 1 / 4;
  var xthird = xsecond + scalewidth * 1 / 4;
  var xfourth = xthird + scalewidth * 1 / 4;

  // Stroke
  ctx.beginPath();
  ctx.lineWidth = line1 + 2;
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#ffffff";
  ctx.moveTo(x_offset, yzero);
  ctx.lineTo(xzero + 1, yzero);
  ctx.stroke();

  //sections black/white
  ctx.beginPath();
  ctx.lineWidth = line1;
  ctx.strokeStyle = "#000000";
  ctx.moveTo(x_offset, yzero);
  ctx.lineTo(xfirst, yzero);
  ctx.stroke();

  ctx.beginPath();
  ctx.lineWidth = line1;
  ctx.strokeStyle = "#FFFFFF";
  ctx.moveTo(xfirst, yzero);
  ctx.lineTo(xsecond, yzero);
  ctx.stroke();

  ctx.beginPath();
  ctx.lineWidth = line1;
  ctx.strokeStyle = "#000000";
  ctx.moveTo(xsecond, yzero);
  ctx.lineTo(xthird, yzero);
  ctx.stroke();

  ctx.beginPath();
  ctx.lineWidth = line1;
  ctx.strokeStyle = "#FFFFFF";
  ctx.moveTo(xthird, yzero);
  ctx.lineTo(xfourth, yzero);
  ctx.stroke();
}
