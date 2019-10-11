/*
 * Map/Control/AstroScaleLine.js
 *
 * Extends the standard OL scaleline to handle targets other than earth.
 *
 * Depends on OL and maps.js.
 *
 * Author: jrideout
 * Version: 08/18/2010
 */
AstroScaleLine = ol.Class(ol.control.ScaleLine, {
  // the target name (string)
  target: null,

  // length of target's equator in inches
  equatorLength: null,

  // target's equatorial radius in km
  equatorialRadius: null,

  // target's polar radius in km
  polarRadius: null,

  /*
   * Constructor:
   * Create a new scaleline control that can handle targets other than earth.
   *
   * Params: target - the name of the target (string) - required
   *         options - An optional object whose properties will be used to extend the control.
   */
  initialize: function(target, options) {
    this.target = target.toLowerCase();

    // get the equatorial and polar radii from maps.js for this target and compute the
    // length of the equator
    for (var i = 0; i < myJSONmaps.targets.length; i++) {
      if (myJSONmaps.targets[i].name.toLowerCase() == this.target) {
        this.equatorialRadius = myJSONmaps.targets[i].aaxisradius;
        this.polarRadius = myJSONmaps.targets[i].caxisradius;
        this.equatorLength = this.calculateEquatorLength(this.equatorialRadius);
        break;
      }
    }

    OpenLayers.Control.ScaleLine.prototype.initialize.apply(this, [options]);
  },

  /*
   * Overrides the update method in parent to be more accurate when calculating
   * the scale bar for cylindrical projections. Calculations for polar projections
   * stays the same (they are already accurate enough).
   *
   * Instead of using the 0 lat degree length, the center latitude of the current *viewport*
   * is used to calculate the degree length.
   *
   * Please note that most of the code in this method is taken from the parent update method.
   */
  update: function() {
    var res = this.map.getResolution();
    if (!res) {
      return;
    }

    // get current center lat of viewport
    var centerLat = this.map.getCenter().lat;

    var curMapUnits = this.map.getUnits();

    // get our own copy of the inches per unit object
    var inches = OpenLayers.Util.extend({}, OpenLayers.INCHES_PER_UNIT);

    // set up degree length to match current center lat
    inches["dd"] = this.getDegLength(centerLat);

    // convert maxWidth to map units
    var maxSizeData = this.maxWidth * res * inches[curMapUnits];
    var geodesicRatio = 1;
    if(this.geodesic === true) {
      var maxSizeGeodesic = this.getGeodesicLength(this.maxWidth);
      var maxSizeKilometers = maxSizeData / inches["km"];
      geodesicRatio = maxSizeGeodesic / maxSizeKilometers;
      maxSizeData *= geodesicRatio;
    }

    // decide whether to use large or small scale units
    var topUnits;
    var bottomUnits;
    if(maxSizeData > 100000) {
      topUnits = this.topOutUnits;
      bottomUnits = this.bottomOutUnits;
    } else {
      topUnits = this.topInUnits;
      bottomUnits = this.bottomInUnits;
    }

    // and to map units units
    var topMax = maxSizeData / inches[topUnits];
    var bottomMax = maxSizeData / inches[bottomUnits];

    // now trim this down to useful block length
    var topRounded = this.getBarLen(topMax);
    var bottomRounded = this.getBarLen(bottomMax);

    // and back to display units
    topMax = topRounded / inches[curMapUnits] * inches[topUnits];
    bottomMax = bottomRounded / inches[curMapUnits] * inches[bottomUnits];

    // and to pixel units
    var topPx = topMax / res / geodesicRatio;
    var bottomPx = bottomMax / res / geodesicRatio;

    // now set the pixel widths
    // and the values inside them
    if (this.eBottom.style.visibility == "visible"){
      this.eBottom.style.width = Math.round(bottomPx) + "px";
      this.eBottom.innerHTML = bottomRounded + " " + bottomUnits ;
    }

    if (this.eTop.style.visibility == "visible"){
      this.eTop.style.width = Math.round(topPx) + "px";
      this.eTop.innerHTML = topRounded + " " + topUnits;
    }
  },

  /*
   * Overrides the parent method to use a custom Vincenty formula
   * that takes the target's radii and flattening into account.
   *
   * Please note that most of this code is taken from the parent method.
   *
   * Parameters:
   * pixels - {Number} the pixels to get the geodesic length in meters for.
   */
  getGeodesicLength: function(pixels) {
    var map = this.map;
    var centerPx = map.getPixelFromLonLat(map.getCenter());
    var bottom = map.getLonLatFromPixel(centerPx.add(0, -pixels / 2));
    var top = map.getLonLatFromPixel(centerPx.add(0, pixels / 2));
    var source = map.getProjectionObject();
    var dest = new OpenLayers.Projection("EPSG:4326");
    if(!source.equals(dest)) {
      bottom.transform(source, dest);
      top.transform(source, dest);
    }
    return this.distVincenty(bottom, top);
  },

  /*
   * Helper method that returns the length of the equator in inches
   * given an equatorial radius in kilometers.
   *
   * Param: equatorialRadius - the equatorial radius in kilometers (float)
   * Returns: length of the equator in inches (float)
   */
  calculateEquatorLength: function(equatorialRadius) {
    return (2 * Math.PI * equatorialRadius * 39370.0787);
  },

  /*
   * Helper method that returns the length of a degree of latitude in inches for
   * the given specific latitude.
   *
   * Params: lat - the specific latitude in degrees (float)
   * Returns: the length of a degree in inches (float)
   */
  getDegLength: function(lat) {
    // convert to radians
    lat = (((2.0 * Math.PI) / 360.0) * lat);
    return ((Math.cos(lat) * this.equatorLength) / 360.0);
  },

  /*
   * Given two objects representing points with geographic coordinates, this
   * calculates the distance between those points on the surface of an
   * ellipsoid.
   *
   * Please note that most of this code is taken from OL's distVincenty method.
   * I have modified it to use the radii of the current target instead of using
   * the earth's.
   *
   * This method can optionally be used by our custom scaleline control
   * for cylindrical projections if the geodesic option is set. In most
   * cases, this method did not seem to help with the accuracy of the
   * scalebar.
   *
   * Params: p1 - any object with both .lat, .lon properties
   *         p2 - any object with both .lat, .lon properties
   *
   * Returns:
   *     The distance (in km) between the two input points as measured on an
   *     ellipsoid.  Note that the input point objects must be in geographic
   *     coordinates (decimal degrees) and the return distance is in kilometers.
   */
  distVincenty: function(p1, p2) {
    // set up constants based on target
    var a = this.equatorialRadius * 1000;  // in meters
    var b = this.polarRadius * 1000;       // in meters
    var f = ((a - b) / a);

    var L = OpenLayers.Util.rad(p2.lon - p1.lon);
    var U1 = Math.atan((1-f) * Math.tan(OpenLayers.Util.rad(p1.lat)));
    var U2 = Math.atan((1-f) * Math.tan(OpenLayers.Util.rad(p2.lat)));
    var sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
    var sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);
    var lambda = L, lambdaP = 2*Math.PI;
    var iterLimit = 20;
    while (Math.abs(lambda-lambdaP) > 1e-12 && --iterLimit>0) {
      var sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda);
      var sinSigma = Math.sqrt((cosU2*sinLambda) * (cosU2*sinLambda) +
      (cosU1*sinU2-sinU1*cosU2*cosLambda) * (cosU1*sinU2-sinU1*cosU2*cosLambda));
      if (sinSigma==0) {
        return 0;  // co-incident points
      }
      var cosSigma = sinU1*sinU2 + cosU1*cosU2*cosLambda;
      var sigma = Math.atan2(sinSigma, cosSigma);
      var alpha = Math.asin(cosU1 * cosU2 * sinLambda / sinSigma);
      var cosSqAlpha = Math.cos(alpha) * Math.cos(alpha);
      var cos2SigmaM = cosSigma - 2*sinU1*sinU2/cosSqAlpha;
      var C = f/16*cosSqAlpha*(4+f*(4-3*cosSqAlpha));
      lambdaP = lambda;
      lambda = L + (1-C) * f * Math.sin(alpha) *
      (sigma + C*sinSigma*(cos2SigmaM+C*cosSigma*(-1+2*cos2SigmaM*cos2SigmaM)));
    }
    if (iterLimit==0) {
      return NaN;  // formula failed to converge
    }
    var uSq = cosSqAlpha * (a*a - b*b) / (b*b);
    var A = 1 + uSq/16384*(4096+uSq*(-768+uSq*(320-175*uSq)));
    var B = uSq/1024 * (256+uSq*(-128+uSq*(74-47*uSq)));
    var deltaSigma = B*sinSigma*(cos2SigmaM+B/4*(cosSigma*(-1+2*cos2SigmaM*cos2SigmaM)-
      B/6*cos2SigmaM*(-3+4*sinSigma*sinSigma)*(-3+4*cos2SigmaM*cos2SigmaM)));
    var s = b*A*(sigma-deltaSigma);
    var d = s.toFixed(3)/1000; // round to 1mm precision
    return d;
  },

  CLASS_NAME: "AstroScaleLine"
});
