/*
 * Map/Control/AstroGeometryEditor.js
 *
 * Custom map control that allows editing of vector features (geometries)
 * on multiple layers. Under the hood, this class uses 
 * OpenLayers.Control.ModifyFeature to do the editing.
 *
 * Depends on OL.
 *
 * Author: jrideout
 * Version: 10/20/2010
 */
AstroGeometryEditor = OpenLayers.Class(OpenLayers.Control, {
  layers: null, // array of layers that have features to be edited

  layer: null,  // the root container vector layer that holds all of the layers (needed for event handling)

  modifyFeatures: null, // one ModifyFeature object for each layer

  /*
   * Constructor:
   * Create a new edit control that listens for edit requests on the 
   * supplied vector layer(s).
   * 
   * Parameters: layers  - array of vector layers
   *             options - {Object} An optional object whose properties 
   *                       will be used to extend the control.
   */
  initialize: function(layers, options) {
    OpenLayers.Control.prototype.initialize.apply(this, [options]);

    this.layers = layers;
    this.layer = new OpenLayers.Layer.Vector.RootContainer(this.id + "_container", {layers: this.layers});

    // configure click feature handler to listen for events on root container
    this.handler = new OpenLayers.Handler.Feature(this, this.layer, {click: this.clickFeature, clickout: this.clickoutFeature});

    var modifyFeatureOptions = {
      clickout: true,
      toggle: true,
      mode: OpenLayers.Control.ModifyFeature.RESHAPE
    };

    this.modifyFeatures = [];
    for (var i = 0; i < this.layers.length; i++) {
      if (this.layers[i].isVector) {
        this.modifyFeatures.push(new OpenLayers.Control.ModifyFeature(this.layers[i], modifyFeatureOptions));
      }
    }
  },

  activate: function() {
    // add root container layer to map
    if (!this.active) {
      if (this.map.getLayersByName(this.layer.name).length == 0) {
        this.map.addLayer(this.layer);
      }
    }

    return OpenLayers.Control.prototype.activate.apply(this, arguments);
  },

  deactivate: function() {
    if (this.active) {
      // deactivate all modify feature controls
      for (var i = 0; i < this.modifyFeatures.length; i++) {
        this.modifyFeatures[i].deactivate();
      }

      // remove root container layer from map
      if (this.map.getLayersByName(this.layer.name).length != 0) {
        this.map.removeLayer(this.layer);
      }
    }

    return OpenLayers.Control.prototype.deactivate.apply(this, arguments);
  },

  setMap: function(map) {
    this.handler.setMap(map);
    for (var i = 0; i < this.modifyFeatures.length; i++) {
      this.modifyFeatures[i].setMap(map);
    }
    OpenLayers.Control.prototype.setMap.apply(this, arguments);
  },

  clickFeature: function(feature) {
    var layer = feature.layer;

    // find appropriate modify feature control
    for (var i = 0; i < this.modifyFeatures.length; i++) {
      if (this.modifyFeatures[i].layer == layer) {
        this.modifyFeatures[i].activate();
        this.modifyFeatures[i].beforeSelectFeature(feature);
        this.modifyFeatures[i].selectFeature(feature);
        this.map.removeLayer(this.layer);
        //layer.events.triggerEvent("featureselected", {feature: feature});
      }
      else {
        this.modifyFeatures[i].deactivate();
      }
    }
  },

  clickoutFeature: function(feature) {
    var layer = feature.layer;

    for (var i = 0; i < this.modifyFeatures.length; i++) {
      if (this.modifyFeatures[i].layer == layer) {
        this.map.addLayer(this.layer);
        this.modifyFeatures[i].unselectFeature(feature);
        //layer.events.triggerEvent("featureunselected", {feature: feature});
      }
      this.modifyFeatures[i].deactivate();
    }
  },

  CLASS_NAME: "AstroGeometryEditor"
});
