/*
 * Console/AstroConsole.js
 *
 * Class to drive console.
 *
 * Dependencies: AstroMap.js
 */

//over-ridable callbacks
// TODO
function astroConsoleHistoryPrev() {};
function astroConsoleHistoryNext() {};

/*
 * Constructor creates the console elements and puts them on the page.
 *
 * Parameters: astroMap        - reference to map that this console is attached to
 *             consoleSettings - hash of options, if null uses sensible defaults
 *
 * The following options may be set:
 *   target           - the target string. Default: 'Mars'
 *   projButtons      - boolean indicating whether or not to display projection buttons. Default: false
 *   lonLatSelects    - boolean indicating whether or not to display lon/lat dropdowns. Default: false
 *   mouseLonLat      - boolean indicating whether or not to display mouse lon/lats. Default: false
 *   targetInfoDiv    - string for target info div id. This element should already exist on the page. Default: 'astroConsoleTargetInfo'
 *   projButtonsDiv   - string for projection buttons div id. This element should already exist on the page. Default: 'astroConsoleProjectionButtons'
 *   lonLatSelectsDiv - string for lon/lat selects div id. This element should already exist on the page. Default: 'astroConsoleLonLatSelects'
 *   keyDiv           - string for keys div id (the legend). This element should already exist on the page. Default: 'astroConsoleKey'
 */
function AstroConsole(astroMap, consoleSettings) {
  // instance variables
  this.astroMap = astroMap;
  this.target = 'Mars';
  this.targetInfo = false;
  this.projButtons = false;
  this.lonLatSelects = false;
  this.mouseLonLat = false;
  this.featureFinder = false;

  // key colors
  this.keyColors = ["blue", "green", "purple", "aqua", "lime", "olive", "teal"];
  this.key = new Array();

  // image path
  this.imagePath = this.astroMap.imagePath;

  // console divs
  this.targetInfoDiv = "astroConsoleTargetInfo";
  this.projButtonsDiv = "astroConsoleProjectionButtons";
  this.lonLatSelectsDiv = "astroConsoleLonLatSelects";
  this.keyDiv = "astroConsoleKey";
  this.featureFinderDiv = "astroFeatureFinder";

  //element ids . . . only one per page
  this.targetImgId = "astroConsoleTargetImage";
  this.northPoleImgId = "astroProjectionNorthPole";
  this.cylindricalImgId = "astroProjectionCylindrical";
  this.southPoleImgId = "astroProjectionSouthPole";
  this.lonDirSelectId = "astroConsoleLonDirSelect";
  this.lonDomSelectId = "astroConsoleLonDomSelect";
  this.latTypeSelectId = "astroConsoleLatTypeSelect";
  this.mouseLonLatDiv = "astroConsoleLonLat";
  this.featureTypeSelectId = "astroFeatureType";
  this.featureNameSelectId = "astroFeatureName";

  // set up console according to supplied settings
  if (consoleSettings) {
    if (consoleSettings.target) {
      this.target = consoleSettings.target;
    }
    if (consoleSettings.targetInfo) {
      this.targetInfo = true;
    }
    if (consoleSettings.projButtons) {
      this.projButtons = true;
    }
    if (consoleSettings.lonLatSelects) {
      this.lonLatSelects = true;
    }
    if (consoleSettings.featureFinder) {
      this.featureFinder = true;
    }
    if (consoleSettings.mouseLonLat) {
      this.mouseLonLat = true;
    }
    if (consoleSettings.targetInfoDiv) {
      this.targetInfoDiv = consoleSettings.targetInfoDiv;
    }
    if (consoleSettings.projButtonsDiv) {
      this.projButtonsDiv = consoleSettings.projButtonsDiv;
    }
    if (consoleSettings.lonLatSelectsDiv) {
      this.lonLatSelectsDiv = consoleSettings.lonLatSelectsDiv;
    }
    if (consoleSettings.keyDiv) {
      this.keyDiv = consoleSettings.keyDiv;
    }
    if (consoleSettings.featureFinderDiv) {
      this.featureFinderDiv = consoleSettings.featureFinderDiv;
    }
  }

  // create console UI elements
  if (this.targetInfo) {
    this.targetInfoSetup();
  }
  if (this.mouseLonLat) {
    this.mouseLonLatSetup();
  }
  if (this.projButtons) {
    this.projButtonsSetup();
  }
  if (this.lonLatSelects) {
    this.lonLatSelectsSetup(null, null);
  }
  if (this.featureFinder) {
    this.featureFinderSetup();
  }
};

/*
 * Creates the target info elements.
 */
AstroConsole.prototype.targetInfoSetup = function() {
  var container = document.getElementById(this.targetInfoDiv);

  var targetImg = document.createElement("img");
  targetImg.setAttribute('id', this.targetImgId);
  targetImg.setAttribute('alt', this.target);
  targetImg.setAttribute('title', this.target);
  targetImg.setAttribute('src', this.imagePath + this.target.toLowerCase() + ".png");
  targetImg.className ='astroConsoleTargetImg';
  container.appendChild(targetImg);

  var targetSpan = document.createElement("span");
  targetSpan.className ='astroConsoleTargetName';
  targetSpan.innerHTML = this.target + '<br/>';
  container.appendChild(targetSpan);
};

/*
 * Creates the lon/lat display for the current mouse position
 * and adds it to target info div.
 */
AstroConsole.prototype.mouseLonLatSetup = function() {
  var container = document.getElementById(this.targetInfoDiv);

  var lonLatTitle = document.createElement("div");
  lonLatTitle.className ='astroConsoleLonLatTitle';
  lonLatTitle.innerHTML = 'Lat Lon: &nbsp;';
  container.appendChild(lonLatTitle);

  var lonLatDiv = document.createElement("div");
  lonLatDiv.setAttribute('id', this.mouseLonLatDiv);
  lonLatDiv.className = 'astroConsoleLonLat';
  container.appendChild(lonLatDiv);
};


/*
 * Requires JQuery
 */
AstroConsole.prototype.featureFinderSetup = function() {
  var ftE = document.getElementById(this.featureFinderDiv);
  var ftSelect = document.createElement("select");
  ftSelect.setAttribute("id", this.featureTypeSelectId);
  ftSelect.className = "astroConsoleSelect";
  var ftOption = document.createElement("option");
  ftOption.text = "Select Type. . .";
  ftOption.value = "t";
  ftSelect.appendChild(ftOption);
  ftE.appendChild(ftSelect);

  var fnE = document.getElementById(this.featureFinderDiv);
  var fnSelect = document.createElement("select");
  fnSelect.setAttribute("id", this.featureNameSelectId);
  fnSelect.className = "astroConsoleSelect";
  fnSelect.disabled = true;
  var fnOption = document.createElement("option");
  fnOption.text = "Select Name. . .";
  fnOption.value = "t";
  fnSelect.appendChild(fnOption);
  fnE.appendChild(fnSelect);

};

//
AstroConsole.prototype.featureFinderLoadTypes = function(target) {

  $.ajax({
	   url: this.upcAjaxURLNoParams,
	   dataType: 'json',
	   data: 'act=featureTypesAjaxGet&target=' + target,
	   type: 'POST',
	   success: function(json) {

	     if (!json) {

	               } else {

			 var e = document.getElementById('upcFeatureType');
			 e.options.length = 0;
			 var newOption=document.createElement("option");
			 newOption.innerHTML= 'Select Type. . .';
			 e.appendChild(newOption);
			 var ft =  json['featureTypes']['type'];
			 for (var type in json['featureTypes']['type']) {

			   newOption=document.createElement("option");
			   newOption.text = ft[type];
			   newOption.innerHTML= ft[type];
			   newOption.setAttribute('value',ft[type]);
			   e.appendChild(newOption);
			             }
			         }
	             }
	 });
};

/*
 * Creates the projection switch buttons.
 */
AstroConsole.prototype.projButtonsSetup = function() {
  var container = document.getElementById(this.projButtonsDiv);

  // north pole
  var northPoleImg = document.createElement("img");
  northPoleImg.setAttribute('id',this.northPoleImgId);
  northPoleImg.setAttribute('alt','North Polar Stereographic');
  northPoleImg.setAttribute('title','North Polar Stereographic');
  northPoleImg.setAttribute('src',this.imagePath + "north-pole.png");
  northPoleImg.className ='astroConsoleProjectionButton';
  var that = this;
  northPoleImg.addEventListener("click", function() {that.astroMap.switchProjection('north-polar stereographic');});

  container.appendChild(northPoleImg);

  // cylindrical
  var cylindricalImg = document.createElement("img");
  cylindricalImg.setAttribute('id', this.cylindricalImgId);
  cylindricalImg.setAttribute('alt','Simple Cylindrical');
  cylindricalImg.setAttribute('title','Simple Cylindrical');
  cylindricalImg.setAttribute('src',this.imagePath + "cylindrical.png");
  cylindricalImg.className ='astroConsoleProjectionButton';
  cylindricalImg.addEventListener("click", function() {that.astroMap.switchProjection('cylindrical');});
  container.appendChild(cylindricalImg);

  // south pole
  var southPoleImg = document.createElement("img");
  southPoleImg.setAttribute('id', this.southPoleImgId);
  southPoleImg.setAttribute('alt','South Polar Stereographic');
  southPoleImg.setAttribute('title','South Polar Stereographic');
  southPoleImg.setAttribute('src',this.imagePath + "south-pole.png");
  southPoleImg.className ='astroConsoleProjectionButton';
  southPoleImg.addEventListener("click", function() {that.astroMap.switchProjection('south-polar stereographic');});

  container.appendChild(southPoleImg);
};

/*
 * Activates the projection button (changes the images) for the passed in projection.
 *
 * Parameter: clickedProjection - the projection string
 * Returns: nothing
 */
AstroConsole.prototype.toggleProjection = function(clickedProjection) {
  switch(clickedProjection) {
    case 'cylindrical':
      document.getElementById(this.cylindricalImgId).src = this.imagePath + "cylindrical-hot.png";
      document.getElementById(this.northPoleImgId).src = this.imagePath + "north-pole.png";
      document.getElementById(this.southPoleImgId).src = this.imagePath + "south-pole.png";
      break;
    case 'north-polar stereographic':
      document.getElementById(this.cylindricalImgId).src = this.imagePath + "cylindrical.png";
      document.getElementById(this.northPoleImgId).src = this.imagePath + "north-pole-hot.png";
      document.getElementById(this.southPoleImgId).src = this.imagePath + "south-pole.png";
      break;
    case 'south-polar stereographic':
      document.getElementById(this.cylindricalImgId).src = this.imagePath + "cylindrical.png";
      document.getElementById(this.northPoleImgId).src = this.imagePath + "north-pole.png";
      document.getElementById(this.southPoleImgId).src = this.imagePath + "south-pole-hot.png";
      break;
  }
};

/*
 * Creates the lon/lat dropdown boxes.
 *
 * Parameters: lonDir - the default longitude direction string ('PositiveWest' or 'PositiveEast')
 *             lonDom - the default longitude domain string (360 or 180)
 * Returns: nothing
 */
AstroConsole.prototype.lonLatSelectsSetup = function(lonDir, lonDom) {
  // get the div that will hold the dropdowns
  var container = document.getElementById(this.lonLatSelectsDiv);

  // create the dropdowns, populating them with options

  // Lon Dir dropdown
  var lonDirSelect = document.createElement("select");
  lonDirSelect.setAttribute("id", this.lonDirSelectId);
  lonDirSelect.className = "astroConsoleSelect";
  // create options
  var selected = (lonDir == 'PositiveWest') ? 'SELECTED' : '';
  var lonDirOption1 = document.createElement("option");
  lonDirOption1.text = "Positive East";
  lonDirOption1.value = "PositiveEast";
  var lonDirOption2 = document.createElement("option");
  lonDirOption2.text = "Positive West";
  lonDirOption2.value = "PositiveWest" + selected;

  // add the options to the select element
  try {
    // works for standards-compliant browsers (non-IE)
    lonDirSelect.add(lonDirOption1, null);
    lonDirSelect.add(lonDirOption2, null);
  } catch (e) {
    // needed for the wonderful IE
    lonDirSelect.add(lonDirOption1);
    lonDirSelect.add(lonDirOption2);
  }

  // wrap dropdown in its own div
  var lonDirSelectDiv = document.createElement("div");
  lonDirSelectDiv.appendChild(lonDirSelect);

  // add dropdown to container div
  container.appendChild(lonDirSelectDiv);

  // Lon Domain dropdown
  var lonDomSelect = document.createElement("select");
  lonDomSelect.setAttribute("id", this.lonDomSelectId);
  lonDomSelect.className = "astroConsoleSelect";
  selected = (lonDom == 360) ? 'SELECTED' : '';
  var lonDomOption1 = document.createElement("option");

  // unicode escapes needed because text is interpretted literally (can't use HTML entities),
  // and IE doesn't accept innerHTML on options
  lonDomOption1.text = "0\u00B0 to 360\u00B0";
  lonDomOption1.value = "360";
  var lonDomOption2 = document.createElement("option");
  lonDomOption2.text = "-180\u00B0 to 180\u00B0\u00A0";
  lonDomOption2.value = "180" + selected;

  try {
    lonDomSelect.add(lonDomOption1, null);
    lonDomSelect.add(lonDomOption2, null);
  } catch (e) {
    lonDomSelect.add(lonDomOption1);
    lonDomSelect.add(lonDomOption2);
  }

  var lonDomSelectDiv = document.createElement("div");
  lonDomSelectDiv.appendChild(lonDomSelect);
  container.appendChild(lonDomSelectDiv);

  // Lat Type dropdown
  var latTypeSelect = document.createElement("select");
  latTypeSelect.setAttribute("id", this.latTypeSelectId);
  latTypeSelect.className = "astroConsoleSelect";
  var latTypeOption1 = document.createElement("option");
  latTypeOption1.text = "Planetocentric";
  latTypeOption1.value = "Planetocentric";
  var latTypeOption2 = document.createElement("option");
  latTypeOption2.text = "Planetographic";
  latTypeOption2.value = "Planetographic";

  try {
    latTypeSelect.add(latTypeOption1, null);
    latTypeSelect.add(latTypeOption2, null);
  } catch (e) {
    latTypeSelect.add(latTypeOption1);
    latTypeSelect.add(latTypeOption2);
  }

  var latTypeSelectDiv = document.createElement("div");
  latTypeSelectDiv.appendChild(latTypeSelect);
  container.appendChild(latTypeSelectDiv);
};

/*
 * Adds a key to the console's legend.
 *
 * Parameters: name  - the key's label
 *             color - the color of the key
 * Returns: nothing
 */
AstroConsole.prototype.addKey = function(name, color) {
  this.key.push(name);
  var currentColor = (color == null) ? this.keyColors[this.key.length -1] : color;

  // container div
  var keyDiv = null;
  var itemsPerDiv = 5;
  if ((this.key.length == 1) || ((this.key.length % itemsPerDiv) == 0)) {
    keyDiv = document.createElement("div");
    keyDiv.setAttribute('id', this.keyDiv + "" + Math.floor(this.key.length/itemsPerDiv));
    keyDiv.className = 'astroConsoleKeyDiv';
    document.getElementById(this.keyDiv).appendChild(keyDiv);
  } else {
    keyDiv = document.getElementById(this.keyDiv + "" + Math.floor(this.key.length/itemsPerDiv));
  }

  var keyBullet = document.createElement("img");
  keyBullet.setAttribute('alt', name);
  keyBullet.setAttribute('title',name);
  keyBullet.setAttribute('src', this.imagePath + "glowBox_" + currentColor + '.png');
  keyBullet.className ='upcRenderBullet';
  keyDiv.appendChild(keyBullet);
  var keyTitle = document.createElement("span");
  keyTitle.className ='astroConsoleKeyTitle';
  keyTitle.innerHTML = ' ' + name + '<br/>';
  keyDiv.appendChild(keyTitle);
};

/*
 * Get the color of the specified key.
 *
 * Parameter: name - the name of the key
 * Returns: the color of the key
 */
AstroConsole.prototype.getKeyColor = function(name) {
  return (this.keyColors[this.key.indexOf(name)]);
};

/*
 * Removes all of the keys from the console and key array.
 */
AstroConsole.prototype.removeAllKeys = function() {
  var container = document.getElementById(this.keyDiv);
  while(container.hasChildNodes()) {
    container.removeChild(container.lastChild);
  }
  this.key = new Array;
};

