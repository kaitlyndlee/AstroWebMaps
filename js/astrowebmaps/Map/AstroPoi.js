/*
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


