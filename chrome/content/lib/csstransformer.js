/* See license.txt for terms of usage */

define([
    "firebug/lib/object",
    "firebug/lib/trace",
    "firebug/lib/xpcom",
    "firebug/lib/dom",
    "firebug/lib/domplate",
    "firebug/lib/locale"
],
function(Obj, FBTrace, Xpcom, Dom, Domplate, Locale) {
    
with (Domplate) {

	Firebug.FireFile.CssTransformer = Obj.extend(Firebug.Module, {

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

		generateCSSContents: function(styleSheet, compress) {

            var retVal = "";

			// Get Comments Map
			if(Firebug.FireFile.prefs.display_comments && !compress) {
				var commentMap = this.getCommentsWithSelector(styleSheet);
			}

			// Loop through Rules
            for (var i=0; i < styleSheet.cssRules.length; i++) {

                // Get Contents for rule type
                var rule = styleSheet.cssRules[i];

				// Append Comment if exists
				if(Firebug.FireFile.prefs.display_comments && !compress && rule.selectorText != undefined) {
				    var commentIndex = this.getSelectorId(rule.selectorText);
				    if(commentMap[commentIndex] != undefined) {
					    retVal += commentMap[commentIndex];
					}
				}

                switch(rule.type) {
                    default: // Static rules
                        retVal += this.generateTextFromStaticRule(rule);
                        break;
                }

			}

			// Check if compression is off
			if(!compress) {
			    // beautify css
			    retVal = this.cssbeautify(retVal, {
			        indent: '    '
			    });

			    // fix comments display
			    retVal = this.fixCommentsOutput(retVal);
			}

			// Fix color values
			retVal = this.rgbToHex(retVal);

			return retVal;
        },

        fixCommentsOutput: function(str) {

            // fix all comment starters (/*) after curly brackets
            str = str.replace(/\}\/\*/g, "}\n\n/*");

            // fix all comment finishers (*/) before curly brackets
            str = str.replace(/\*\/([^\n]{1})/g, "*/\n$1");

            return str;
        },

		getCommentsWithSelector: function(styleSheet) {

			// Load Comments from Cache
			if(this.commentMap[styleSheet.href] != undefined) {
				return this.commentMap[styleSheet.href];
			}

			// Create comments list
			var styleContents = this.getStyleSheetContents(styleSheet, Firebug.currentContext);

			// Get comments before rules
			var result;
		    var regexp = /((?:\/\*[^\*]+\*\/[\s]*)+)[\s]*([\n\t\sa-zA-Z0-9.#-_]+){/g;
			var commentList = {};
			while(result = regexp.exec(styleContents)) {
			    var comment = result[1];
			    comment = this.trim(comment.split(" ").join('\u00A0'));

			    if(comment != "" && comment != undefined && comment.substr(0,1) != "@") {
			        var commentIndex = this.getSelectorId(result[2]);
			        commentList[commentIndex] = comment;
			    }
			}

			this.commentMap[styleSheet.href] = commentList;
			return commentList;
		},

		getSelectorId: function(selectorText) {
            return this.trim(selectorText).replace(/(,\s|,\n)/g, ",");
		},

		getCommentForRule: function(rule) {

			// Get Stylesheet
			var styleSheet = rule.parentStyleSheet;
			if(!styleSheet) { return false; }

			// Load Comment Array
			var commentMap = this.getCommentsWithSelector(styleSheet);

			// Deliver Comments
			if(commentMap != undefined) {
			    var commentIndex = this.getSelectorId(rule.selectorText);

				if(commentMap[commentIndex] != undefined) {
					return commentMap[commentIndex];
				}
			}

			return false;
		},

		getPropertyCommentsWithSelector: function(styleSheet, object) {

			// Load Comments from Cache
			if(this.propertyCommentMap[styleSheet.href] != undefined) {
				return this.propertyCommentMap[styleSheet.href];
			}

			var styleContents = this.getStyleSheetContents(styleSheet, Firebug.currentContext);

			// Get Comments before Properties
			var result;
			var regexp = /([^{}\/]+)\s*{([^}]+\/\*[\s\S]+\*\/[^}]+)}/g;
			var propertyCommentList = {};
			while(result = regexp.exec(styleContents)) {
			    var selector = this.trim(result[1]);
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

			return retVal;
		},

        trim: function(str) {
        	return this.ltrim(this.rtrim(str));
        },

        ltrim: function(str) {
        	return str.replace(/^[\s]+/g, "");
        },

        rtrim: function(str) {
        	return str.replace(/[\s]+$/g, "");
        },

		getPropertyCommentsForRule: function(object) {

			// Get Stylesheet
			var styleSheet = object.rule.parentStyleSheet;
			if(!styleSheet) { return false; }

			// Load Comment Array
			var propertyCommentMap = this.getPropertyCommentsWithSelector(styleSheet, object);

			// Deliver Comments
			if(propertyCommentMap != undefined) {
				var commentIndex = this.getSelectorId(object.rule.selectorText);
				if(propertyCommentMap[commentIndex] != undefined) {
					return propertyCommentMap[commentIndex];
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

        generateTextFromStaticRule: function(rule) {
            return rule.cssText;
        },

		createRuleString: function(name, value) {
			return name + ":" + value + ";";
		},

		createStyleString: function(name, value) {
			return name + " {\n" + value + "}\n\n";
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
	    },

        cssbeautify: function(style, opt) {
            'use strict';

            var options, index = 0, length = style.length, blocks, formatted = '',
                ch, ch2, str, state, State, depth, quote, comment,
                openbracesuffix = true,
                trimRight;

            options = arguments.length > 1 ? opt : {};
            if (typeof options.indent === 'undefined') {
                options.indent = ' ';
            }
            if (typeof options.openbrace === 'string') {
                openbracesuffix = (options.openbrace === 'end-of-line');
            }

            function isWhitespace(c) {
                return (c === ' ') || (c === '\n') || (c === '\t') || (c === '\r') || (c === '\f');
            }

            function isQuote(c) {
                return (c === '\'') || (c === '"');
            }

            // FIXME: handle Unicode characters
            function isName(c) {
                return (ch >= 'a' && ch <= 'z') ||
                    (ch >= 'A' && ch <= 'Z') ||
                    (ch >= '0' && ch <= '9') ||
                    '-_*.:#'.indexOf(c) >= 0;
            }

            function appendIndent() {
                var i;
                for (i = depth; i > 0; i -= 1) {
                    formatted += options.indent;
                }
            }

            function openBlock() {
                formatted = trimRight(formatted);
                if (openbracesuffix) {
                    formatted += ' {';
                } else {
                    formatted += '\n';
                    appendIndent();
                    formatted += '{';
                }
                if (ch2 !== '\n') {
                    formatted += '\n';
                }
                depth += 1;
            }

            function closeBlock() {
                depth -= 1;
                formatted = trimRight(formatted);
                formatted += '\n';
                appendIndent();
                formatted += '}';
                blocks.push(formatted);
                formatted = '';
            }

            if (String.prototype.trimRight) {
                trimRight = function (s) {
                    return s.trimRight();
                };
            } else {
                // old Internet Explorer
                trimRight = function (s) {
                    return s.replace(/\s+$/, '');
                };
            }

            State = {
                Start: 0,
                AtRule: 1,
                Block: 2,
                Selector: 3,
                Ruleset: 4,
                Property: 5,
                Separator: 6,
                Expression: 7
            };

            depth = 0;
            state = State.Start;
            comment = false;
            blocks = [];

            // We want to deal with LF (\n) only
            style = style.replace(/\r\n/g, '\n');

            while (index < length) {
                ch = style.charAt(index);
                ch2 = style.charAt(index + 1);
                index += 1;

                // Inside a string literal?
                if (isQuote(quote)) {
                    formatted += ch;
                    if (ch === quote) {
                        quote = null;
                    }
                    if (ch === '\\' && ch2 === quote) {
                        // Don't treat escaped character as the closing quote
                        formatted += ch2;
                        index += 1;
                    }
                    continue;
                }

                // Starting a string literal?
                if (isQuote(ch)) {
                    formatted += ch;
                    quote = ch;
                    continue;
                }

                // Comment
                if (comment) {
                    formatted += ch;
                    if (ch === '*' && ch2 === '/') {
                        comment = false;
                        formatted += ch2;
                        index += 1;
                    }
                    continue;
                } else {
                    if (ch === '/' && ch2 === '*') {
                        comment = true;
                        formatted += ch;
                        formatted += ch2;
                        index += 1;
                        continue;
                    }
                }

                if (state === State.Start) {

                    // Copy white spaces and control characters
                    if (ch <= ' ' || ch.charCodeAt(0) >= 128) {
                        state = State.Start;
                        formatted += ch;
                        continue;
                    }

                    // Selector or at-rule
                    if (isName(ch) || (ch === '@')) {

                        // Clear trailing whitespaces and linefeeds.
                        str = trimRight(formatted);

                        if (str.length === 0) {
                            // If we have empty string after removing all the trailing
                            // spaces, that means we are right after a block.
                            // Ensure a blank line as the separator.
                            formatted = '\n\n';
                        } else {
                            // After finishing a ruleset or directive statement,
                            // there should be one blank line.
                            if (str.charAt(str.length - 1) === '}' ||
                                    str.charAt(str.length - 1) === ';') {

                                formatted = str + '\n\n';
                            } else {
                                // After block comment, keep all the linefeeds but
                                // start from the first column (remove whitespaces prefix).
                                while (true) {
                                    ch2 = formatted.charAt(formatted.length - 1);
                                    if (ch2 !== ' ' && ch2.charCodeAt(0) !== 9) {
                                        break;
                                    }
                                    formatted = formatted.substr(0, formatted.length - 1);
                                }
                            }
                        }
                        formatted += ch;
                        state = (ch === '@') ? State.AtRule : State.Selector;
                        continue;
                    }
                }

                if (state === State.AtRule) {

                    // ';' terminates a statement.
                    if (ch === ';') {
                        formatted += ch;
                        state = State.Start;
                        continue;
                    }

                    // '{' starts a block
                    if (ch === '{') {
                        openBlock();
                        state = State.Block;
                        continue;
                    }

                    formatted += ch;
                    continue;
                }

                if (state === State.Block) {

                    // Selector
                    if (isName(ch)) {

                        // Clear trailing whitespaces and linefeeds.
                        str = trimRight(formatted);

                        if (str.length === 0) {
                            // If we have empty string after removing all the trailing
                            // spaces, that means we are right after a block.
                            // Ensure a blank line as the separator.
                            formatted = '\n\n';
                        } else {
                            // Insert blank line if necessary.
                            if (str.charAt(str.length - 1) === '}') {
                                formatted = str + '\n\n';
                            } else {
                                // After block comment, keep all the linefeeds but
                                // start from the first column (remove whitespaces prefix).
                                while (true) {
                                    ch2 = formatted.charAt(formatted.length - 1);
                                    if (ch2 !== ' ' && ch2.charCodeAt(0) !== 9) {
                                        break;
                                    }
                                    formatted = formatted.substr(0, formatted.length - 1);
                                }
                            }
                        }

                        appendIndent();
                        formatted += ch;
                        state = State.Selector;
                        continue;
                    }

                    // '}' resets the state.
                    if (ch === '}') {
                        closeBlock();
                        state = State.Start;
                        continue;
                    }

                    formatted += ch;
                    continue;
                }

                if (state === State.Selector) {

                    // '{' starts the ruleset.
                    if (ch === '{') {
                        openBlock();
                        state = State.Ruleset;
                        continue;
                    }

                    // '}' resets the state.
                    if (ch === '}') {
                        closeBlock();
                        state = State.Start;
                        continue;
                    }

                    formatted += ch;
                    continue;
                }

                if (state === State.Ruleset) {

                    // '}' finishes the ruleset.
                    if (ch === '}') {
                        closeBlock();
                        state = State.Start;
                        if (depth > 0) {
                            state = State.Block;
                        }
                        continue;
                    }

                    // Make sure there is no blank line or trailing spaces inbetween
                    if (ch === '\n') {
                        formatted = trimRight(formatted);
                        formatted += '\n';
                        continue;
                    }

                    // property name
                    if (!isWhitespace(ch)) {
                        formatted = trimRight(formatted);
                        formatted += '\n';
                        appendIndent();
                        formatted += ch;
                        state = State.Property;
                        continue;
                    }
                    formatted += ch;
                    continue;
                }

                if (state === State.Property) {

                    // ':' concludes the property.
                    if (ch === ':') {
                        formatted = trimRight(formatted);
                        formatted += ': ';
                        state = State.Expression;
                        if (isWhitespace(ch2)) {
                            state = State.Separator;
                        }
                        continue;
                    }

                    // '}' finishes the ruleset.
                    if (ch === '}') {
                        closeBlock();
                        state = State.Start;
                        if (depth > 0) {
                            state = State.Block;
                        }
                        continue;
                    }

                    formatted += ch;
                    continue;
                }

                if (state === State.Separator) {

                    // Non-whitespace starts the expression.
                    if (!isWhitespace(ch)) {
                        formatted += ch;
                        state = State.Expression;
                        continue;
                    }

                    // Anticipate string literal.
                    if (isQuote(ch2)) {
                        state = State.Expression;
                    }

                    continue;
                }

                if (state === State.Expression) {

                    // '}' finishes the ruleset.
                    if (ch === '}') {
                        closeBlock();
                        state = State.Start;
                        if (depth > 0) {
                            state = State.Block;
                        }
                        continue;
                    }

                    // ';' completes the declaration.
                    if (ch === ';') {
                        formatted = trimRight(formatted);
                        formatted += ';\n';
                        state = State.Ruleset;
                        continue;
                    }

                    formatted += ch;
                    continue;
                }

                // The default action is to copy the character (to prevent
                // infinite loop).
                formatted += ch;
            }

            formatted = blocks.join('') + formatted;

            return formatted;
        }

	});
    
    return Firebug.FireFile.CssTransformer;

}});
