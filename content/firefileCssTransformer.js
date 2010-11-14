
FBL.ns(function() { with(FBL) {

	Firebug.FireFile.CssTransformer = extend(Firebug.Module, {
		
		css3CompatibilityList: {
			"-moz-border-radius": ["border-radius", "-webkit-border-radius", "-khtml-border-radius"],
			"-moz-border-radius-topleft": ["border-top-left-radius", "-webkit-border-top-left-radius", "-khtml-border-top-left-radius"],
			"-moz-border-radius-topright": ["border-top-right-radius", "-webkit-border-top-right-radius", "-khtml-border-top-right-radius"],
			"-moz-border-radius-bottomleft": ["border-bottom-left-radius", "-webkit-border-bottom-left-radius", "-khtml-border-bottom-left-radius"],
			"-moz-border-radius-bottomright": ["border-bottom-right-radius", "-webkit-border-bottom-right-radius", "-khtml-border-bottom-right-radius"],
			"-moz-box-shadow": ["box-shadow", "-webkit-box-shadow", "-khtml-box-shadow"]
		},
		
		getCommentForRule: function(rule) {
			
			var domUtils = CCSV("@mozilla.org/inspector/dom-utils;1", "inIDOMUtils");
			var parentSheet = rule.parentStyleSheet;
			if(!parentSheet) { 
				return false; 
			}
			var styleContents = this.getStyleSheetContents(parentSheet, FirebugContext);
			var styleLines = styleContents.split("\n");
			var lineIndex = domUtils.getRuleLine(rule)-1;
			var commentLineIndex = domUtils.getRuleLine(rule)-2;
			
			// Build Css Portion up to rule
			var selectorText = rule.selectorText.replace(".", "\.");
			var needle = new RegExp('[^}]*(\\/\\*[^/]+\\*\\/)[^}]*\\s' + selectorText + "\\s*\\{", "");
			var result = styleContents.match(needle);

			if(result) {
				return RegExp.$1;
			}
			
			return false;
		},
		
		getStyleSheetContents: function(sheet, context) {
		    if (sheet.ownerNode instanceof HTMLStyleElement)
		        return sheet.ownerNode.innerHTML;
		    else
		        return context.sourceCache.load(sheet.href).join("");	
		},
		
		generateCSSContents: function(styleSheet, compress) {
			
            var retVal = "";
            
            // FETCH DATA
			try{
	            for (var i=0; i < styleSheet.cssRules.length; i++) {
					var style = styleSheet.cssRules[i];
					var props = this.getCssProps(style);
					var styleString = "";
					
					// Check for empty styles
					if(props.length > 0 || Firebug.FireFile.prefs.remove_empty_styles === false) {

						// Todo: Fetch Comments

						// Append Rules
						for(var j=0;j<props.length;j++) {

							// Append Rule as is
							styleString += this.createRuleString(props[j].name, props[j].value, compress);
							
							// Fix CSS3 behaviour
							if(Firebug.FireFile.prefs.autofix_css3 && props[j].name.substr(0, 4) == "-moz") {
								if(this.css3CompatibilityList[props[j].name]) {
									for(var k=0;k<this.css3CompatibilityList[props[j].name].length;k++) {
										// Add translatable rule
										styleString += this.createRuleString(this.css3CompatibilityList[props[j].name][k], props[j].value, compress);
									}
								}
							}

						}

						// Append Comment if exists
						var comment = this.getCommentForRule(style);
						if(comment) {
							if(!compress) {
								retVal += comment + "\n";
							}
						}

						// Append Style Definition
						retVal += this.createStyleString(style.selectorText, styleString, compress);
						
					}
	            }
			}catch(err) {
				// Firebug.Console.log(err);
			}
            
			return retVal;
        },
		
		createRuleString: function(name, value, compress) {
			if(compress) {
				return name + ":" + value + ";";
			}else{
				return "\t" + name + ": " + value + ";\n";
			}
		},
		
		createStyleString: function(name, value, compress) {
			if(compress) {
				return name + "{" + value + "}";
			}else{
				return name + " {\n" + value + "}\n\n";
			}
		},
		
		getCssProps: function(style) {
			return FirebugContext.getPanel("css").parseCSSProps(style, false);
		}
		
	});
	
	Firebug.registerModule(Firebug.FireFile.CssTransformer);

}});
