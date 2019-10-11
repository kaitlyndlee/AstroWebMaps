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
