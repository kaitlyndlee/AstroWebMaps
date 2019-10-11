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
