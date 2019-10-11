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

  //add nomen WFS
  var wfsSource = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    url: function(extent) {
      return 'https://astrocloud.wr.usgs.gov/dataset/data/nomenclature/' +
	currentTarget['name'].toUpperCase() + '/WFS?service=WFS&version=1.1.0&request=GetFeature&' +
	'outputFormat=application/json&srsname=EPSG:4326&' +
	'bbox=' + extent.join(',') + ',EPSG:4326';
    },
    serverType: 'geoserver',
    crossOrigin: 'anonymous',
    strategy: ol.loadingstrategy.bbox
  });
  var wfs = new ol.layer.Vector({
    source: wfsSource,
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({
	color: 'rgba(0, 0, 255, 1.0)',
	width: 2
      })
    })
  });
  overLayers.push(wfs);

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

