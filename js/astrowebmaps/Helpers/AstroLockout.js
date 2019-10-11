/*
 * Helpers/AstroLockout.js
 *
 * Helper class to pause the UI with a lockout div (useful for AJAX calls).
 */

/*
 * The constructor creates a new lockout object with no divs.
 */
function AstroLockout() {
  this.lockoutDivs = new Array();
}

/*
 * Displays a div (invisible or gray) that prevents the user from interacting
 * with the UI.
 *
 * Parameters: name - the reference label given to this specific lockout div (string, no spaces)
 *             gray - if true, the div will be gray
 * Returns: nothing
 */
AstroLockout.prototype.on = function(name, gray) {
  if (!this.lockoutDivs[name] || (this.lockoutDivs[name] == null)) {
    this.lockoutDivs[name] = document.createElement('div');
    this.lockoutDivs[name].setAttribute('id','lockoutDiv' + name);
    this.lockoutDivs[name].style.position = 'absolute';
    this.lockoutDivs[name].style.cursor = 'wait';
    this.lockoutDivs[name].style.height = '1000px';
    this.lockoutDivs[name].style.width = '100%';    
    this.lockoutDivs[name].style.top = '0';    
    this.lockoutDivs[name].style.left = '0';        
    this.lockoutDivs[name].style.zIndex = '9999999';    
    if (gray) {
      this.lockoutDivs[name].style.background = '#000000';
      this.lockoutDivs[name].style.opacity = .2;
      this.lockoutDivs[name].style.filter = 'alpha(opacity=20)';
    }
    document.getElementsByTagName('body')[0].appendChild(this.lockoutDivs[name]);
    document.getElementById('lockoutDiv' + name).innerHTML = '&nbsp;';
  }
};

/*
 * Removes the lockout div.
 *
 * Parameter: name - the reference label of the lockout div (should be the same one used to turn the div on)
 * Returns: nothing
 */
AstroLockout.prototype.off = function(name) {
  if (this.lockoutDivs[name] != null) {
    document.getElementsByTagName('body')[0].removeChild(this.lockoutDivs[name]);
    this.lockoutDivs[name] = null;
  }
};
