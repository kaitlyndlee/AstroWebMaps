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
};