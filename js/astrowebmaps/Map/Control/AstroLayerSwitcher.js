/*
 * Map/Control/AstroLayerSwitcher.js
 *
 * Extends the standard OL layer switcher to include opacity controls for each
 * overlay.
 *
 * Many thanks to jvanulden for his custom layer switcher example:
 *   http://dev.openlayers.org/sandbox/jvanulden/openlayers/examples/extended-layerswitcher.html
 * In this class's redraw method, I use his opacity control code. Credit goes to him fully.
 *
 * Depends on OL.
 *
 * TODO: vector layer doesn't support opacity in IE7, ticket submitted to OL (#2810)
 *
 * Author: jrideout
 * Version: 08/20/2010
 */
AstroLayerSwitcher = OpenLayers.Class(OpenLayers.Control.LayerSwitcher, {
  // instance variables
  imagePath: null,  // should have trailing '/'

  /*
   * Constructor:
   * Create a new layer switcher control that includes opacity controls for
   * each overlay.
   * 
   * Params: options - An optional object whose properties will be used to extend the control.
   */
  initialize: function(options) {
    this.imagePath = options.imagePath;
    OpenLayers.Control.LayerSwitcher.prototype.initialize.apply(this, arguments);
  },

  /*
   * Overrides the redraw method in parent to include opacity controls for each
   * overlay in the list.
   * 
   * Please note that most of the code in this method is taken from the parent redraw method,
   * with a few modifications added in (which are taken from jvanulden's example, see class
   * comments).
   */
  redraw: function() {
    //if the state hasn't changed since last redraw, no need 
    // to do anything. Just return the existing div.
    if (!this.checkRedraw()) { 
      return this.div; 
    } 

    //clear out previous layers 
    this.clearLayersArray("base");
    this.clearLayersArray("data");
    
    var containsOverlays = false;
    var containsBaseLayers = false;
    
    // Save state -- for checking layer if the map state changed.
    // We save this before redrawing, because in the process of redrawing
    // we will trigger more visibility changes, and we want to not redraw
    // and enter an infinite loop.
    var len = this.map.layers.length;
    this.layerStates = new Array(len);
    for (var i=0; i <len; i++) {
      var layer = this.map.layers[i];
      this.layerStates[i] = {
        'name': layer.name, 
        'visibility': layer.visibility,
        'inRange': layer.inRange,
        'id': layer.id
      };
    }    

    var layers = this.map.layers.slice();
    if (!this.ascending) { layers.reverse(); }
    for(var i=0, len=layers.length; i<len; i++) {
      var layer = layers[i];
      var baseLayer = layer.isBaseLayer;

      if (layer.displayInLayerSwitcher) {

        if (baseLayer) {
          containsBaseLayers = true;
        } else {
          containsOverlays = true;
        }    

        // only check a baselayer if it is *the* baselayer, check data
        //  layers if they are visible
        var checked = (baseLayer) ? (layer == this.map.baseLayer)
                                  : layer.getVisibility();

        // create input element
        var inputElem = document.createElement("input");
        inputElem.id = this.id + "_input_" + layer.name;
        inputElem.name = (baseLayer) ? this.id + "_baseLayers" : layer.name;
        inputElem.type = (baseLayer) ? "radio" : "checkbox";
        inputElem.value = layer.name;
        inputElem.checked = checked;
        inputElem.defaultChecked = checked;

        if (!baseLayer && !layer.inRange) {
          inputElem.disabled = true;
        }
        var context = {
          'inputElem': inputElem,
          'layer': layer,
          'layerSwitcher': this
        };
        OpenLayers.Event.observe(inputElem, "mouseup", 
          OpenLayers.Function.bindAsEventListener(this.onInputClick,
                                                  context)
        );
        
        // create label span
        var labelSpan = document.createElement("span");
        OpenLayers.Element.addClass(labelSpan, "labelSpan")
        if (!baseLayer && !layer.inRange) {
          labelSpan.style.color = "gray";
        }
        labelSpan.innerHTML = layer.name;
        labelSpan.style.verticalAlign = (baseLayer) ? "bottom" 
                                                    : "baseline";
        OpenLayers.Event.observe(labelSpan, "click", 
          OpenLayers.Function.bindAsEventListener(this.onInputClick,
                                                  context)
        );

        // create line break
        var br = document.createElement("br");
        
        var groupArray = (baseLayer) ? this.baseLayers
                                     : this.dataLayers;
        groupArray.push({
          layer: layer,
          inputElem: inputElem,
          labelSpan: labelSpan
        });

        var groupDiv = (baseLayer) ? this.baseLayersDiv
                                   : this.dataLayersDiv;

        // add our new elements to the layer switcher div
        groupDiv.appendChild(inputElem);
        groupDiv.appendChild(labelSpan);

        // only add opacity control to raster overlays for now
        // (ticket #2810 submitted to OL detailing IE7 vector layer opacity bug)
        if (!baseLayer && !layer.isVector) {
          // opacity minus button
          var opacityMinusButton = document.createElement("img");
          opacityMinusButton.src = this.imagePath + "minus.png";
          opacityMinusButton.style.cursor = "pointer";
          opacityMinusButton.alt = "Decrease opacity";
          opacityMinusButton.title = "Decrease opacity";

          // span to hold opacity bar
          var opacitySpan = document.createElement("span");
          opacitySpan.setAttribute("id", "opacitySpan_" + layer.id);
          opacitySpan.style.display = "inline-block";
          opacitySpan.style.width = "22px";
          opacitySpan.style.cursor = "pointer";

          // make sure opacity bar is set to whatever the default opacity is
          //layer.setOpacity(layer.opacity);

          // figure out which bar image should be set for the default opacity
          var defaultOpacity = layer.opacity;
          var imgNum = (defaultOpacity != null) ? (defaultOpacity * 10).toFixed(0) : "10";

          // opacity bar/slider image
          var opacitySliderImg = document.createElement("img");
          opacitySliderImg.setAttribute("id", "opacitySliderImg_" + layer.id);
          opacitySliderImg.src = this.imagePath + "opacity_slider" + imgNum + ".png";
          opacitySliderImg.width = "22";
          opacitySliderImg.height = "12";
          opacitySliderImg.alt = "Set Opacity";
          opacitySliderImg.title = "Set Opacity";

          // create hidden input to hold opacity value (between 0 and 1)
          var opacityTextInput = document.createElement("input");
          opacityTextInput.setAttribute("id", "opacity_" + layer.id);
          opacityTextInput.setAttribute("type", "hidden");
          opacityTextInput.setAttribute("value", "1.0");

          // opacity plus button
          var opacityPlusButton = document.createElement("img");
          opacityPlusButton.src = this.imagePath + "plus.png";
          opacityPlusButton.style.cursor = "pointer";
          opacityPlusButton.alt = "Increase opacity";
          opacityPlusButton.title = "Increase opacity"; 

          // create context for opacity minus button and register event handler
          var opacityMinusContext = {
            layer: layer,
            byOpacity: "-0.1",
            layerSwitcher: this
          };

          OpenLayers.Event.observe(opacityMinusButton, "click",
            // call changeLayerOpacity when the minus button is clicked. The context is included
            // so that we know how much to decrement the opacity by, and which layer this
            // applies to
            OpenLayers.Function.bindAsEventListener(this.changeLayerOpacity, opacityMinusContext)
          );
   
          // do the same for opacity plus button
          var opacityPlusContext = {
            layer: layer,
            byOpacity: "0.1",
            layerSwitcher: this
          };

          OpenLayers.Event.observe(opacityPlusButton, "click",
            OpenLayers.Function.bindAsEventListener(this.changeLayerOpacity, opacityPlusContext)
          );

          // do the same for opacity span
          var opacitySpanContext = {
            layer: layer,
            layerSwitcher: this
          };

          // register event handler for when user clicks somewhere in the opacity span
          OpenLayers.Event.observe(opacitySpan, "click",
            OpenLayers.Function.bindAsEventListener(this.changeLayerOpacityFromSpanClick, opacitySpanContext)
          );

          var opacityContainer = document.createElement("span");
          opacityContainer.style.paddingLeft = "5px";
          opacityContainer.style.whiteSpace = "nowrap";

          opacitySpan.appendChild(opacitySliderImg);
          opacityContainer.appendChild(opacityMinusButton);
          opacityContainer.appendChild(opacitySpan);
          opacityContainer.appendChild(opacityTextInput);
          opacityContainer.appendChild(opacityPlusButton);
          groupDiv.appendChild(opacityContainer);
        }
        groupDiv.appendChild(br);
      }
    }

    // if no overlays, dont display the overlay label
    this.dataLbl.style.display = (containsOverlays) ? "" : "none";
    this.dataLbl.style.color = '#00bfff';
    
    // if no baselayers, dont display the baselayer label
    this.baseLbl.innerHTML = 'Base Layer (Control Network)';
    this.baseLbl.style.color = '#00bfff';
    this.baseLbl.style.display = (containsBaseLayers) ? "" : "none";
    
    return this.div;
  },

  /*
   * Changes opacity of a given layer for a given delta.
   *
   * Note: 'this' refers to the object this method is bound to (which
   * isn't necessarily this object). To get to this object, use 'this.layerSwitcher'
   * instead.
   *
   * Parameters:
   * e - {Event}
   *
   * Context:
   * - {string} amount to increase or decrease opacity value
   * - {<OpenLayers.Layer>} layer
   * - {<OpenLayers.Control.LayerSwitcher>} layerSwitcher
   */
  changeLayerOpacity: function(e) {
    var maxOpacity = 1.0;
    var minOpacity = 0.1;
    var opacity = (this.layer.opacity != null) ? this.layer.opacity : 1.0;
    var i = parseFloat(this.byOpacity);
    var opacityElement = "opacity_" + this.layer.id;
    var opacityImg = "opacitySliderImg_" + this.layer.id;
    var newOpacity = (parseFloat(opacity + i)).toFixed(1);

    newOpacity = Math.min(maxOpacity, Math.max(minOpacity, newOpacity));
 
    OpenLayers.Util.getElement(opacityElement).value = newOpacity;
    OpenLayers.Util.getElement(opacityImg).src = this.layerSwitcher.imagePath + "opacity_slider" + (newOpacity * 10).toFixed(0) + ".png";

    this.layer.setOpacity(newOpacity);
  },

  /*
   * Changes opacity of a given layer based on where in the
   * opacity span the user clicked.
   *
   * Note: 'this' refers to the object this method is bound to (which
   * isn't necessarily this object). To get to this object, use 'this.layerSwitcher'
   * instead.
   *
   * Parameters:
   * e - {Event}
   *
   * Context:
   * - {<OpenLayers.Layer>} layer
   * - {<OpenLayers.Control.LayerSwitcher>} layerSwitcher
   */
  changeLayerOpacityFromSpanClick: function(e) {
    var maxOpacity = 1.0;
    var minOpacity = 0.1;

    if (!e) {
      var e = window.event;
    }

    // get the opacity span that was clicked
    var opacitySpan = OpenLayers.Util.getElement("opacitySpan_" + this.layer.id);
    // get the hidden opacity input field
    var opacityInput = OpenLayers.Util.getElement("opacity_" + this.layer.id);
    // get the opacity image
    var opacityImg = OpenLayers.Util.getElement("opacitySliderImg_" + this.layer.id);

    // get the mouse position relative to the middle of the opacity span (cross-browser compatible, hopefully!).
    // spanOffset should be a number between 0 and 22 (as that is the max width of the span)
    var spanOffset = this.layerSwitcher.getRelativeCoordinates(e, opacitySpan).x;

    // calculate what opacity (roughly) was clicked
    var newOpacity = (spanOffset / 22).toFixed(1);
    newOpacity = Math.min(maxOpacity, Math.max(minOpacity, newOpacity));

    // update elements
    opacityInput.value = newOpacity;
    opacityImg.src = this.layerSwitcher.imagePath + "opacity_slider" + (newOpacity * 10).toFixed(0) + ".png";
    
    // set new opacity on layer
    this.layer.setOpacity(newOpacity);
  },

  /*
   * Credit goes to Steven Wittens (http://acko.net/blog/mouse-handling-and-absolute-positions-in-javascript)
   * for this method.
   */
  getAbsolutePosition: function(element) {
    var r = { x: element.offsetLeft, y: element.offsetTop };
    if (element.offsetParent) {
      var tmp = this.getAbsolutePosition(element.offsetParent);
      r.x += tmp.x;
      r.y += tmp.y;
    }
    return r;
  },

  /*
   * Retrieve the coordinates of the given event relative to the center
   * of the widget.
   *
   * Credit goes to Steven Wittens (http://acko.net/blog/mouse-handling-and-absolute-positions-in-javascript)
   * for this method.
   *
   * @param event
   *   A mouse-related DOM event.
   * @param reference
   *   A DOM element whose position we want to transform the mouse coordinates to.
   * @return
   *    A hash containing keys 'x' and 'y'.
   */
  getRelativeCoordinates: function(event, reference) {
    var x, y;
    event = event || window.event;
    var el = event.target || event.srcElement;

    if (!window.opera && typeof event.offsetX != 'undefined') {
      // Use offset coordinates and find common offsetParent
      var pos = { x: event.offsetX, y: event.offsetY };

      // Send the coordinates upwards through the offsetParent chain.
      var e = el;
      while (e) {
        e.mouseX = pos.x;
        e.mouseY = pos.y;
        pos.x += e.offsetLeft;
        pos.y += e.offsetTop;
        e = e.offsetParent;
      }

      // Look for the coordinates starting from the reference element.
      var e = reference;
      var offset = { x: 0, y: 0 }
      while (e) {
        if (typeof e.mouseX != 'undefined') {
          x = e.mouseX - offset.x;
          y = e.mouseY - offset.y;
          break;
        }
        offset.x += e.offsetLeft;
        offset.y += e.offsetTop;
        e = e.offsetParent;
      }

      // Reset stored coordinates
      e = el;
      while (e) {
        e.mouseX = undefined;
        e.mouseY = undefined;
        e = e.offsetParent;
      }
    }
    else {
      // Use absolute coordinates
      var pos = this.getAbsolutePosition(reference);

      // Subtract distance to middle
      x = event.pageX  - pos.x;
      y = event.pageY - pos.y;
    }
    return { x: x, y: y };
  },

  CLASS_NAME: "AstroLayerSwitcher"
});
