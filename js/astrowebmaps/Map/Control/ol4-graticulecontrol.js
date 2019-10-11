/*
 * Hacked version of OL4 graticule
 * - works with ol-debug.js, fails with compressed ol.js
 * - hack version with these fixes is ol-astro.js
 */

// constructor -
AstroGraticule = function(options, projection) {

  this.projection = projection;
  ol.Graticule.call(this, options);
};
ol.inherits(AstroGraticule, ol.Graticule);


// NEW createGraticule
/**
 * @param {ol.Extent} extent Extent.
 * @param {ol.Coordinate} center Center.
 * @param {number} resolution Resolution.
 * @param {number} squaredTolerance Squared tolerance.
 * @private
 */
AstroGraticule.prototype.createGraticule_ = function(extent, center, resolution, squaredTolerance) {

  var interval = this.getInterval_(resolution);
  if (interval == -1) {
    this.meridians_.length = this.parallels_.length = 0;
    if (this.meridiansLabels_) {
      this.meridiansLabels_.length = 0;
    }
    if (this.parallelsLabels_) {
      this.parallelsLabels_.length = 0;
    }
    return;
  }

  var centerLonLat = this.toLonLatTransform_(center);
  var centerLon = centerLonLat[0];
  var centerLat = centerLonLat[1];
  var maxLines = this.maxLines_;
  var cnt, idx, lat, lon;

  var validExtent = [
    Math.max(extent[0], this.minLonP_),
    Math.max(extent[1], this.minLatP_),
    Math.min(extent[2], this.maxLonP_),
    Math.min(extent[3], this.maxLatP_)
  ];

  validExtent = ol.proj.transformExtent(validExtent, this.projection_,
      'EPSG:4326');
  var maxLat = validExtent[3];
  var maxLon = validExtent[2];
  var minLat = validExtent[1];
  var minLon = validExtent[0];

  //*** tweak for polar - mbailen
  if (this.projection == "north-polar stereographic") {
      minLat = 60;
  }
  if (this.projection == "south-polar stereographic") {
      maxLat = -60;
  }
  //*** tweak to extend grid - mbailen
  console.log('*** ' + this.projection);
  if (this.projection == "cylindrical") {
    maxLon = 720;
    minLon = -360;
    this.maxLon_ = maxLon;
    this.minLon_ = minLon;
  }

  // Create meridians

  centerLon = Math.floor(centerLon / interval) * interval;
  lon = ol.math.clamp(centerLon, this.minLon_, this.maxLon_);

  idx = this.addMeridian_(lon, minLat, maxLat, squaredTolerance, extent, 0);

  cnt = 0;
  while (lon != this.minLon_ && cnt++ < maxLines) {
    lon = Math.max(lon - interval, this.minLon_);
    idx = this.addMeridian_(lon, minLat, maxLat, squaredTolerance, extent, idx);
  }

  lon = ol.math.clamp(centerLon, this.minLon_, this.maxLon_);

  cnt = 0;
  while (lon != this.maxLon_ && cnt++ < maxLines) {
    lon = Math.min(lon + interval, this.maxLon_);
    idx = this.addMeridian_(lon, minLat, maxLat, squaredTolerance, extent, idx);
  }

  this.meridians_.length = idx;
  if (this.meridiansLabels_) {
    this.meridiansLabels_.length = idx;
  }

  // Create parallels

  centerLat = Math.floor(centerLat / interval) * interval;
  lat = ol.math.clamp(centerLat, this.minLat_, this.maxLat_);

  idx = this.addParallel_(lat, minLon, maxLon, squaredTolerance, extent, 0);

  cnt = 0;
  while (lat != this.minLat_ && cnt++ < maxLines) {
    lat = Math.max(lat - interval, this.minLat_);
    idx = this.addParallel_(lat, minLon, maxLon, squaredTolerance, extent, idx);
  }

  lat = ol.math.clamp(centerLat, this.minLat_, this.maxLat_);

  cnt = 0;
  while (lat != this.maxLat_ && cnt++ < maxLines) {
    lat = Math.min(lat + interval, this.maxLat_);
    idx = this.addParallel_(lat, minLon, maxLon, squaredTolerance, extent, idx);
  }

  this.parallels_.length = idx;
  if (this.parallelsLabels_) {
    this.parallelsLabels_.length = idx;
  }

};



// NEW getInterval_
/**
 * @param {number} resolution Resolution.
 * @return {number} The interval in degrees.
 * @private
 */
AstroGraticule.prototype.getInterval_ = function(resolution) {

  //*** hack for polar meridians - mbailen
  if (this.projection != "cylindrical") {return 10;}

  var centerLon = this.projectionCenterLonLat_[0];
  var centerLat = this.projectionCenterLonLat_[1];
  var interval = -1;
  var i, ii, delta, dist;
  var target = Math.pow(this.targetSize_ * resolution, 2);
  /** @type {Array.<number>} **/
  var p1 = [];
  /** @type {Array.<number>} **/
  var p2 = [];
  for (i = 0, ii = AstroGraticule.intervals_.length; i < ii; ++i) {
    delta = AstroGraticule.intervals_[i] / 2;
    p1[0] = centerLon - delta;
    p1[1] = centerLat - delta;
    p2[0] = centerLon + delta;
    p2[1] = centerLat + delta;
    this.fromLonLatTransform_(p1, p1);
    this.fromLonLatTransform_(p2, p2);
    dist = Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2);
    if (dist <= target) {
      break;
    }
    interval = AstroGraticule.intervals_[i];
  }
  return interval;
};
