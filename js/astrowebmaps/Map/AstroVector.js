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


