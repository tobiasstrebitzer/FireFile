
FBL.ns(function() { with(FBL) {

	Firebug.FireFile.CssTransformer = extend(Firebug.Module, {
		
		commentMap: [],
		propertyCommentMap: [],
		
		css3CompatibilityList: {
			"-moz-border-radius": ["border-radius", "-webkit-border-radius", "-khtml-border-radius"],
			"-moz-border-radius-topleft": ["border-top-left-radius", "-webkit-border-top-left-radius", "-khtml-border-top-left-radius"],
			"-moz-border-radius-topright": ["border-top-right-radius", "-webkit-border-top-right-radius", "-khtml-border-top-right-radius"],
			"-moz-border-radius-bottomleft": ["border-bottom-left-radius", "-webkit-border-bottom-left-radius", "-khtml-border-bottom-left-radius"],
			"-moz-border-radius-bottomright": ["border-bottom-right-radius", "-webkit-border-bottom-right-radius", "-khtml-border-bottom-right-radius"],
			"-moz-box-shadow": ["box-shadow", "-webkit-box-shadow", "-khtml-box-shadow"]
		},
		
		getCommentsWithSelector: function(styleSheet) {
			
			// Load Comments from Cache
			if(this.commentMap[styleSheet.href] != undefined) {
				return this.commentMap[styleSheet.href];
			}
			
			var styleContents = this.getStyleSheetContents(styleSheet, FirebugContext);
			
			// Get Comments before Rules
			var result;
			var regexp = /((?:\/\*[\s\S]+\*\/[\s]*)+)([^{}]+){/g;
			var commentList = {};
			while(result = regexp.exec(styleContents)) {
			    var comment = result[1];
			    comment = comment.split(" ").join('\u00A0');
				commentList[this.powerTrim(result[2])] = comment;
			}
			this.commentMap[styleSheet.href] = commentList;
			
			return commentList;
		},
		
		getPropertyCommentsWithSelector: function(styleSheet, object) {
		    
			// Load Comments from Cache
			if(this.propertyCommentMap[styleSheet.href] != undefined) {
				return this.propertyCommentMap[styleSheet.href];
			}
			
			var styleContents = this.getStyleSheetContents(styleSheet, FirebugContext);
		    
			// Get Comments before Properties
			var result;
			var regexp = /([^{}\/]+)\s*{([^}]+\/\*[\s\S]+\*\/[^}]+)}/g;
			var propertyCommentList = {};
			while(result = regexp.exec(styleContents)) {
			    var selector = this.powerTrim(result[1]);
				propertyCommentList[selector] = this.getPropertyComments(result[2], object);
			}
			
			this.propertyCommentMap[styleSheet.href] = propertyCommentList;
		},
		
		getPropertyComments: function(str, object) {
			var retVal = [];
			var regexp = /\/\*(.+)\*\//g;
			while(result = regexp.exec(str)) {
			    var comment = result[1];
			    
			    // For now, only add comment
			    retVal.push(comment);
			    continue;
			    
			    // Check if comment is convertable
			    var convregexp = /^([^:]+):\s*([^;]+)(\!important)*;$/;
			    if(convresult = convregexp.exec(comment)) {
			        // Todo: solve !important declarations
			        var important = "";
			        if(convresult[3] != undefined) {
			           important = convresult[3]; 
			        }
                    
                    // Loop through rules
                    Firebug.Console.log("object");
                    Firebug.Console.log(object);
                    
                    // Push to rule properties
			        object.props.push({
			            name: convresult[1],
			            value: convresult[2],
			            wasInherited: false,
			            overridden: false,
			            disabled: true,
			            important: important
			        });
			        
			    }else{
			        retVal.push(comment);
			    }
			}
			Firebug.Console.log(retVal);
			return retVal;
		},
		
		powerTrim: function(str) {
			str = str.replace(/^\s+/, '');
			for (var i = str.length - 1; i >= 0; i--) {
				if (/\S/.test(str.charAt(i))) {
					str = str.substring(0, i + 1);
					break;
				}
			}
			return str;
		},
		
		getCommentForRule: function(rule) {
		    
			// Get Stylesheet
			var styleSheet = rule.parentStyleSheet;
			if(!styleSheet) { return false; }
			
			// Load Comment Array
			var commentMap = this.getCommentsWithSelector(styleSheet);
			
			// Deliver Comments
			if(commentMap != undefined) {				
				var index = this.powerTrim(rule.selectorText);				
				if(commentMap[index] != undefined) {
					return commentMap[index];
				}
			}
						
			return false;
		},
		
		getPropertyCommentsForRule: function(object) {
			
			// Get Stylesheet
			var styleSheet = object.rule.parentStyleSheet;
			if(!styleSheet) { return false; }
			
			// Load Comment Array
			var propertyCommentMap = this.getPropertyCommentsWithSelector(styleSheet, object);
			
			// Deliver Comments
			if(propertyCommentMap != undefined) {
				var index = this.powerTrim(object.rule.selectorText);
				if(propertyCommentMap[index] != undefined) {
					return propertyCommentMap[index];
				}
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
            
			// Get Comments Map
			if(Firebug.FireFile.prefs.display_comments && !compress) {
				var commentMap = this.getCommentsWithSelector(styleSheet);
				// TODO: GENERATE PROPERTY COMMENTS
			}

			// Loop through Rules
            for (var i=0; i < styleSheet.cssRules.length; i++) {
				var style = styleSheet.cssRules[i];
				var props = this.getCssProps(style);
				var styleString = "";
				
				// Check for empty styles
				if(props.length > 0 || Firebug.FireFile.prefs.remove_empty_styles === false) {

					// Append Rules
					for(var j=0;j<props.length;j++) {
						
						styleString += this.createRuleString(props[j].name, props[j].value + props[j].important, compress);
						
						// Fix CSS3 behaviour
						if(Firebug.FireFile.prefs.autofix_css3 && props[j].name.substr(0, 4) == "-moz") {
							if(this.css3CompatibilityList[props[j].name]) {
								for(var k=0;k<this.css3CompatibilityList[props[j].name].length;k++) {
									// Add translatable rule
									styleString += this.createRuleString(this.css3CompatibilityList[props[j].name][k], props[j].value + props[j].important, compress);
								}
							}
						}
					}

					// Append Comment if exists
					if(Firebug.FireFile.prefs.display_comments && !compress) {
						if(commentMap[style.selectorText] != undefined) {
							retVal += commentMap[style.selectorText] + "\n";
						}
					}

					// Append Style Definition
					retVal += this.createStyleString(style.selectorText, styleString, compress);
					
				}

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
	        var props = [];

			// Fix: remove selector from cssText - Only before {
			var cssText = style.cssText.split(style.selectorText+" {").join("{");
			
            var lines = cssText.match(/(?:[^;\(]*(?:\([^\)]*?\))?[^;\(]*)*;?/g);
            var propRE = /\s*([^:\s]*)\s*:\s*(.*?)\s*(! important)?;?$/;
            var line,i=0;
            while(line=lines[i++]){
                m = propRE.exec(line);
                if(!m) {
					continue;
				}

                if (m[2]) {
					this.addProperty(m[1], m[2], !!m[3], false, false, props);
				}
            };

	        return props;
		},

	    addProperty: function(name, value, important, disabled, inheritMode, props) {
	        if (inheritMode && !this.inheritedStyleNames[name]) {
				return;
			}

	        name = this.translateName(name, value);
	        if (name)
	        {
	            value = this.stripUnits(this.rgbToHex(value));
	            important = important ? " !important" : "";

	            var prop = {name: name, value: value, important: important, disabled: disabled};
	            props.push(prop);
	        }
	    },
	
		stripUnits: function(value) {
		    // remove units from '0px', '0em' etc. leave non-zero units in-tact.
		    return value.replace(/(url\(.*?\)|[^0]\S*\s*)|0(%|em|ex|px|in|cm|mm|pt|pc)(\s|$)/gi, function(_, skip, remove, whitespace) {
		    	return skip || ('0' + whitespace);
		    });
		},
		
		rgbToHex: function(value) {
		    return value.replace(/\brgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)/gi, function(_, r, g, b) {
		    return '#' + ((1 << 24) + (r << 16) + (g << 8) + (b << 0)).toString(16).substr(-6).toUpperCase();
		    });
		},
		
		inheritedStyleNames: {
		    "border-collapse": 1,
		    "border-spacing": 1,
		    "border-style": 1,
		    "caption-side": 1,
		    "color": 1,
		    "cursor": 1,
		    "direction": 1,
		    "empty-cells": 1,
		    "font": 1,
		    "font-family": 1,
		    "font-size-adjust": 1,
		    "font-size": 1,
		    "font-style": 1,
		    "font-variant": 1,
		    "font-weight": 1,
		    "letter-spacing": 1,
		    "line-height": 1,
		    "list-style": 1,
		    "list-style-image": 1,
		    "list-style-position": 1,
		    "list-style-type": 1,
		    "opacity": 1,
		    "quotes": 1,
		    "text-align": 1,
		    "text-decoration": 1,
		    "text-indent": 1,
		    "text-shadow": 1,
		    "text-transform": 1,
		    "white-space": 1,
		    "word-spacing": 1,
		    "word-wrap": 1
		},
	
	    translateName: function(name, value)
	    {
	        // Don't show these proprietary Mozilla properties
	        if ((value == "-moz-initial"
	            && (name == "-moz-background-clip" || name == "-moz-background-origin"
	                || name == "-moz-background-inline-policy"))
	        || (value == "physical"
	            && (name == "margin-left-ltr-source" || name == "margin-left-rtl-source"
	                || name == "margin-right-ltr-source" || name == "margin-right-rtl-source"))
	        || (value == "physical"
	            && (name == "padding-left-ltr-source" || name == "padding-left-rtl-source"
	                || name == "padding-right-ltr-source" || name == "padding-right-rtl-source")))
	            return null;

	        // Translate these back to the form the user probably expects
	        if (name == "margin-left-value")
	            return "margin-left";
	        else if (name == "margin-right-value")
	            return "margin-right";
	        else if (name == "margin-top-value")
	            return "margin-top";
	        else if (name == "margin-bottom-value")
	            return "margin-bottom";
	        else if (name == "padding-left-value")
	            return "padding-left";
	        else if (name == "padding-right-value")
	            return "padding-right";
	        else if (name == "padding-top-value")
	            return "padding-top";
	        else if (name == "padding-bottom-value")
	            return "padding-bottom";
	        // XXXjoe What about border!
	        else
	            return name;
	    }
		
	});
	
	Firebug.registerModule(Firebug.FireFile.CssTransformer);

}});
