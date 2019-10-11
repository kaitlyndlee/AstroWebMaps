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

