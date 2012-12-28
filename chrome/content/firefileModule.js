/* See license.txt for terms of usage */

define([
    "firebug/lib/object",
    "firebug/lib/trace",
    "firebug/lib/xpcom",
    "firebug/lib/dom",
    "firebug/lib/domplate",
    "firebug/lib/locale",
    "firebug/lib/events",
    "firefile/lib/csstransformer",
    "firefile/lib/csssaver"
],
function(Obj, FBTrace, Xpcom, Dom, Domplate, Locale, Events, CssTransformer, CssSaver) {
    
with (Domplate) {

    var Cc = Components.classes;
    var Ci = Components.interfaces;

    // Register FireFile string bundles.
    const categoryManager = Xpcom.CCSV("@mozilla.org/categorymanager;1", "nsICategoryManager");
    const stringBundleService = Xpcom.CCSV("@mozilla.org/intl/stringbundle;1", "nsIStringBundleService");
    const PromptService = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
    const PrefBranch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch).getBranch("extensions.firefile.");

    var CSSDomplateBase = {
        isEditable: function(rule)
        {
            return !rule.isSystemSheet && !rule.isNotEditable;
        },
        isSelectorEditable: function(rule)
        {
            return rule.isSelectorEditable && this.isEditable(rule);
        },
        getPropertyValue: function(prop)
        {
            // Disabled, see http://code.google.com/p/fbug/issues/detail?id=5880
            /*
            var limit = Options.get("stringCropLength");
            */
            var limit = 0;
            if (limit > 0)
                return Str.cropString(prop.value, limit);
            return prop.value;
        },
        getComments: function(object) {
			if(!Firebug.FireFile.prefs.display_comments) {
				return [];
			}

			var result = CssTransformer.getCommentForRule(object.rule);
			if(result !== false) {
				return result.split("\n");
			}
            return [];
        },
        getPropertyTextComments: function(object) {
			if(!Firebug.FireFile.prefs.display_comments) {
				return [];
			}

			// For now, return empty array
			return [];

			var result = CssTransformer.getPropertyCommentsForRule(object);
			if(result !== false) {
				return result;
			}
            return [];
        }
    };

    var CSSPropTag = domplate(CSSDomplateBase, {
        tag: DIV({class: "cssProp focusRow", $disabledStyle: "$prop.disabled",
            $editGroup: "$rule|isEditable",
            $cssOverridden: "$prop.overridden", 
            role: "option"},
            
            // Use spaces for indent to make "copy to clipboard" nice.
			SPAN("&nbsp;&nbsp;&nbsp;&nbsp;"),
            SPAN({class: "cssPropName", $editable: "$rule|isEditable"}, 
                "$prop.name"
            ),
            
            // Use a space here, so that "copy to clipboard" has it (issue 3266).
            SPAN({class: "cssColon"}, ":&nbsp;"),
            SPAN({class: "cssPropValue", $editable: "$rule|isEditable",
                _repObject: "$prop.value$prop.important"}, "$prop|getPropertyValue$prop.important"
            ),
            SPAN({class: "cssSemi"}, ";")
        )
    });

    var CSSPropCommentTag = domplate(CSSDomplateBase, {
        tag: DIV({class: "cssProp focusRow propComment"},
			SPAN("&nbsp;&nbsp;&nbsp;&nbsp;/* $comment */")
        )
    });

    var CSSRuleTag = TAG("$rule.tag", {rule: "$rule"});

    var CSSImportRuleTag = domplate({
        tag: DIV({class: "cssRule insertInto focusRow importRule", _repObject: "$rule.rule"},
            "@import &quot;",
            A({class: "objectLink", _repObject: "$rule.rule.styleSheet"}, "$rule.rule.href"),
            "&quot;;"
        )
    });

    var CSSStyleRuleTag = domplate(CSSDomplateBase, 
    {
        tag: 
            DIV({class: "cssRule insertInto",
                $cssEditableRule: "$rule|isEditable",
                $insertInto: "$rule|isEditable",
                $editGroup: "$rule|isSelectorEditable",
                _repObject: "$rule.rule",
                role: "presentation"},
                DIV({class: "ruleComment", title: "Comment"},
                    FOR("comment", "$rule|getComments",
                	    DIV({class: "ruleCommentLine"}, "$comment")
                    )
                ),
                DIV({class: "cssHead focusRow", role : 'listitem'},
                    SPAN({class: "cssSelector", $editable: "$rule|isSelectorEditable"}, 
                        "$rule.selector"), 
                        " {"
            ),
            DIV({role : 'group'},
                DIV({"class" : "cssPropertyListBox", _rule: "$rule", role : 'listbox'},
    	            FOR("comment", "$rule|getPropertyTextComments",
    	                TAG(CSSPropCommentTag.tag, {rule: "$rule", comment: "$comment"})
    	            ),
                    FOR("prop", "$rule.props",
                        TAG(CSSPropTag.tag, {rule: "$rule", prop: "$prop"})
                    )
                )
            ),
            DIV({$editable: "$rule|isEditable", $insertBefore: "$rule|isEditable",
                role:"presentation"},
                "}"
            )
        )
    });

    var FireFileStyleDomPlate = domplate({
        cascadedTag:
            DIV({class: "a11yCSSView", role: 'presentation'},
                DIV({class: "cssNonInherited", role: "list",
                        "aria-label" : Locale.$STR("aria.labels.style rules") },
                    FOR("rule", "$rules",
                        TAG("$ruleTag", {rule: "$rule"})
                    )
                ),
                DIV({role: "list", 'aria-label' :Locale.$STR('aria.labels.inherited style rules')},
                    FOR("section", "$inherited",
                        H1({class: "cssInheritHeader groupHeader focusRow", role: 'listitem' },
                            SPAN({class: "cssInheritLabel"}, "$inheritLabel"),
                            TAG(FirebugReps.Element.shortTag, {object: "$section.element"})
                        ),
                        DIV({role: "group"},
                            FOR("rule", "$section.rules",
                                TAG("$ruleTag", {rule: "$rule"})
                            )
                        )
                    )
                 )
            ),

        ruleTag:
            DIV({class: "cssElementRuleContainer"},
                TAG(CSSStyleRuleTag.tag, {rule: "$rule"}),
			    DIV({class: "cssSourceLinkContainer FireFileChangeHook", styleurl: "$rule|getHref"},
                    DIV({class: "$rule|isTouched", onclick: "$saveChange", title: Locale.$STR("ClickToSaveChanges", "strings_firefile")}),
				    TAG(FirebugReps.SourceLink.tag, {object: "$rule.sourceLink"})
              )
          ),
          
        newRuleTag:
            DIV({class: "cssElementRuleContainer"},
                DIV({class: "cssRule insertBefore", style: "display: none"}, "")
            ),
            
        CSSFontPropValueTag:
            SPAN({class: "cssFontPropValue"},
                FOR("part", "$propValueParts",
                    SPAN({class: "$part.type|getClass", _repObject: "$part.font"}, "$part.value"),
                    SPAN({class: "cssFontPropSeparator"}, "$part|getSeparator")
                )
            ),
        getSeparator: function(part)
        {
            if (part.lastFont || part.type == "important")
                return "";

            if (part.type == "otherProps")
                return " ";

            return ",";
        },

        getClass: function(type)
        {
            switch (type)
            {
                case "used":
                    return "cssPropValueUsed";

                case "unused":
                    return "cssPropValueUnused";

                default:
                    return "";
            }
        },
        
        getHref: function(rule) {
            try{
                return rule.rule.parentStyleSheet.href;
            }catch(ex) {
                return "";
            }
        },
        isTouched: function(rule) {
            var parentSheet = rule.rule.parentStyleSheet;

			// Return inline styles
			if(parentSheet == undefined) {return "";}

            if(Firebug.FireFile.styleSheetExists(parentSheet.href)) {
                if(Firebug.FireFile.getHrefInAllowedSites(parentSheet.href)) {
                    var classes = [];
                    classes.push("fireFileSaveIcon");
                    if(Firebug.FireFile.styleSheetStatus[parentSheet.href] != undefined) {
                        classes.push(Firebug.FireFile.styleSheetStatus[parentSheet.href]);
                    }
                    return classes.join(" ");
                }
            }
            return "";
        },
        saveChange: function(e) {
            var node = Dom.getAncestorByClass(e.target, "FireFileChangeHook");
            var href = node.getAttribute('styleurl');
            CssSaver.save(href);
        },
		isFireFile: true
    });

    Firebug.FireFile = Obj.extend(Firebug.Module, {

		// NOTIFICATIONS
		notifyCount: 0,
		errorCount: 0,

		// FIREFILE RUNTIME
		ffEnabled: false,
		htmlEnabled: false,
		currentURI: "",

		prefs: {
		    enable_notifications: false,
		    inspector_switch_css: true,
			display_comments: true,
			compress_css: false,
			enable_debug_mode: false
		},

		// TIMEOUT HANDLING
		cssPreviousValue: "",
		cssEditing: false,

		destroyContext: function(context, persistedState) {

			var stylesheets = context.window.document.styleSheets;

			// Loop through all stylesheets
			for(var i=0;i<stylesheets.length;i++) {
				this.destroyChanges(stylesheets[i].href);
			}

		},
		destroyChanges: function(href) {
			var modifiedIndex = this.styleSheetIndexByHref(href);
			if(modifiedIndex !== false) {
				Firebug.FireFile.modifiedStylesheets.splice(modifiedIndex,1);
			}else{
				return false;
			}
		},
		getStyleSheetOwnerNode: function(sheet) {
		    for (; sheet && !sheet.ownerNode; sheet = sheet.parentStyleSheet);
		    return sheet.ownerNode;
		},
        cancelAllChanges: function() {
            // SAVE UNSAVED CHANGES
            for(var i=Firebug.FireFile.modifiedStylesheets.length-1;i>=0;i--) {

	            var href = Firebug.FireFile.modifiedStylesheets[i].href;

				// Destroy the changes (FireFile)
				Firebug.FireFile.destroyChanges(href);

				// Reset the changes (Firebug)
				Firebug.FireFile.resetStylesheet(href);

				// Reload Panel
				Firebug.currentContext.getPanel("firefile").select();
            }
        },
		resetStylesheet: function(href) {
			try{
			var stylesheets = Firebug.currentContext.window.document.styleSheets;
			// Loop through all stylesheets
			for(var i=0;i<stylesheets.length;i++) {
				if(stylesheets[i].href == href) {
					// Get current link
		            var ownerNode = this.getStyleSheetOwnerNode(stylesheets[i]);

					// Add new link
		            ownerNode.parentNode.insertBefore(ownerNode, ownerNode.nextSibling);

					// Delete old link
		            ownerNode.parentNode.insertBefore(ownerNode, ownerNode.nextSibling);
				}
			}

			}catch(ex) {
                if(Firebug.FireFile.prefs.enable_debug_mode) {
				    Firebug.Console.log(ex);
                }
			}
		},
		showContext: function(browser, context) {
            
			if(!context) { return; }

			// CHECK IF ALLOWED FOR THIS PAGE
			var prePath = top.gBrowser.currentURI.prePath;

			if(this.hasPrefSitesWithUri(prePath)) {
				this.enableFireFile();
			}else{
				this.disableFireFile();

                // CHECK FOR FIREFILE PAGE
 				var site_script = Firebug.currentContext.name;
                var keyholder = Firebug.currentContext.global.document.getElementById("firefile-key-holder");
                if (keyholder) {
                    if (this.styleSheetIndexByHref(site_script) === false) {
                        var result = PromptService.confirm(null, Firebug.FireFile.__("AddToFireFile"), Firebug.FireFile.__("DoYouWantToAddTheSite", this.getHostFromHref(site_script)));
                        if(result === true) {
                            Firebug.FireFile.getSitesArray();
                            Firebug.FireFile.sitesArray.push({
                                url: site_script,
                                hash: keyholder.innerHTML,
                                label: this.getHostFromHref(site_script)
                            });
                            Firebug.FireFile.saveSitesArray();
                            Firebug.FireFile.setStatus("closed");

                            // OPEN SITES PANEL
                            top.Firebug.chrome.selectPanel("html");
                            top.Firebug.chrome.selectSidePanel("firefile");
                            Firebug.currentContext.getPanel("firefile").select();
                        }
                    }
                }
			}

			return true;

		},
		enableFireFile: function() {
			this.ffEnabled = true;
			this.setStatus("closed");
		},
		disableFireFile: function() {
			this.ffEnabled = false;
			this.setStatus("disabled");
		},
        enable: function() {
            if (!this.initialized) {
                this.initialize();
            }
        },
        initialize: function() {
            
			// Setup System Hooks
            this.hookIntoHtmlContext();
            this.hookIntoCSSPanel();
            
            this.modifiedStylesheets = new Array();
            this.styleSheetStatus = new Array();

            // SETUP PREFERENCES
            for(var key in this.prefs) {
                this.prefs[key] = Firebug.getPref("extensions.firefile", key);
            }

			// OVERRIDE INSPECTOR FUNCTION
			Firebug.FireFile.origInspector = Firebug.Inspector.startInspecting;
            Firebug.Inspector.startInspecting = function() {
                Firebug.FireFile.origInspector.apply(this, arguments);
                if(Firebug.FireFile.prefs.inspector_switch_css) {
                    top.Firebug.chrome.selectPanel("html");
                    top.Firebug.chrome.selectSidePanel("css");
                }
            }

            // OVERRIDE CONTEXT INSPECTOR FUNCTION
			Firebug.FireFile.origContextInspector = Firebug.Inspector.inspectFromContextMenu;
            Firebug.Inspector.inspectFromContextMenu = function() {
                Firebug.FireFile.origContextInspector.apply(this, arguments);
                if(Firebug.FireFile.prefs.inspector_switch_css) {
                    top.Firebug.chrome.selectPanel("html");
                    top.Firebug.chrome.selectSidePanel("css");
                }
            };

            this.initialized = true;

        },
        loadCss: function(url, doc) {
            var newCss = doc.createElement("link");
            newCss.rel = "stylesheet";
            newCss.type = "text\/css";
            newCss.href = url;
            doc.body.appendChild(newCss);
            return newCss;
        },
		hasPrefSitesWithUri: function(prePath) {
			// SHORTER WAY
            var sitesString = Firebug.getPref("extensions.firefile", "sites");;
			if(sitesString.indexOf(prePath) != -1) {
				return true;
			}else{
				return false;
			}
		},
        sitesArray: null,
        getSitesArray: function() {
            // STORED ?
            if(this.sitesArray) { return this.sitesArray; }

            try{
                // BUILD FROM PREFERENCES
                this.sitesArray = [];
                var sitesString = Firebug.getPref("extensions.firefile", "sites");
                var sitesRows = sitesString.split(";");
                for(var i in sitesRows) {
                    var row = sitesRows[i].split("|");
                    if(row[0] != undefined && row[0] != "undefined" && row[1] != undefined && row[1] != "undefined") {
                        this.sitesArray.push({
                            url: row[0],
                            hash: row[1],
                            label: row[2],
                            autosave: Boolean(parseInt(row[3]))
                        });
                    }
                }
            }catch(ex){
                // RETURN EMPTY ON ERROR
                this.sitesArray = [];
            }
            this.saveSitesArray();
            return this.sitesArray;
        },
        saveSitesArray: function() {
            // STORED ?
            if(this.sitesArray == null) { this.sitesArray = [];}

            // SAVE PREFERENCE
            var sitesRows = [];
            for(var i=0;i<this.sitesArray.length;i++) {
                if(this.sitesArray[i] != null) {
                    if(this.sitesArray[i].autosave) {
                        var autosave = "1";
                    }else{
                        var autosave = "0";
                    }
                    sitesRows.push(this.sitesArray[i].url+"|"+this.sitesArray[i].hash+"|"+this.sitesArray[i].label+"|"+autosave);
                }
            }
            Firebug.setPref("extensions.firefile", "sites", sitesRows.join(";"));

        },
        getSiteIndexByUrl: function(url) {
            var sites = this.getSitesArray();
            for(var i=0;i<sites.length;i++) {
                if(sites[i].url == url) {
                    return i;
                }
            }
            return false;
        },
        visualUpdateHandler: function(force) {

            // WHERE AM I?
            var panel = Firebug.chrome.getSelectedPanel();
            var sidePanel = Firebug.chrome.getSelectedSidePanel();

            if(force != undefined) {
                this.updateCssPanelIcon();
				var cssPanel = Firebug.currentContext.getPanel("css");
                cssPanel.updateSelection(cssPanel.selection);
                Firebug.currentContext.getPanel("firefile").select();
                return;
            }

            // PERFORM VISUAL UPDATES
            switch(panel.name) {
                case "stylesheet":
                    this.updateCssPanelIcon();
                    break;
                case "html":
                    if(sidePanel.name == "css") {
						var cssPanel = Firebug.currentContext.getPanel("css");
						cssPanel.updateSelection(cssPanel.selection);
						Firebug.currentContext.getPanel("firefile").select();
                    }else if(sidePanel.name == "firefile") {
                        Firebug.currentContext.getPanel("firefile").select();
                    }
                    break;
            }
        },
        updateCssPanelIcon: function() {
			var stylePanel = Firebug.currentContext.getPanel('stylesheet')
            if(stylePanel.location != undefined) {
                var href = stylePanel.location.href;
                if(this.styleSheetExists(href)) {
                    $("ffCssPanelSaveButton").removeClass("disabled");
                    $("ffCssPanelSaveButton").removeClass("error");
                    $("ffCssPanelSaveButton").removeClass("autosave");
                    $("ffCssPanelSaveButton").removeClass("saving");
                    $("ffCssPanelSaveButton").removeClass("done");
                    if(Firebug.FireFile.styleSheetStatus[href] != undefined) {
                        $("ffCssPanelSaveButton").attr("class", Firebug.FireFile.styleSheetStatus[href]);
                    }
                }else{
                    $("ffCssPanelSaveButton").attr("class", "disabled");
                }
            }
        },
        saveCurrentStylesheet: function() {
            var href = Firebug.currentContext.getPanel('stylesheet').location.href;
            if(this.styleSheetExists(href)) {
                CssSaver.save(href);
            }
        },
        hookIntoHtmlContext: function() {

            // HOOK INTO HTML CONTEXT MENU
            var HtmlCssPrototype = Firebug.getPanelType('css').prototype;
			var HtmlCssContextOrig = HtmlCssPrototype.getContextMenuItems;
			var HtmlCssSelectOrig = HtmlCssPrototype.select;

			HtmlCssPrototype.select = function() {

                // Dispatch original event
                var result = HtmlCssSelectOrig.apply(this, arguments);

				// Add Stylesheet if not exists
                /*
				if(this.document.styleSheets[this.document.styleSheets.length - 1].href != "chrome://firefile/skin/firefile.css") {
					Firebug.FireFile.loadCss("chrome://FireFile/skin/firefile.css", this.document);
				}
                */

				if(this.template.isFireFile == undefined) {
					this.template = FireFileStyleDomPlate;
				}

				return result;
			};

            HtmlCssPrototype.getContextMenuItems = function() {

                // PRE
                var result = HtmlCssContextOrig.apply(this, arguments);

                // GET NODES AND TAGS
                var node = Firebug.currentContext.getPanel("html").selection;
                var tag = node.tagName.toLowerCase();
                var id = node.getAttribute("id");
                var cssclass = node.getAttribute("class");

                if(arguments[0] == undefined) {
                    var styleSheet = Firebug.currentContext.getPanel("stylesheet").selected;
                    var target = styleSheet.cssRules[0];
                    var insertIndex = 0;
                }else{
                    var target = arguments[0];
                    var styleSheet = target.parentStyleSheet
                    for(var insertIndex=0;insertIndex<styleSheet.cssRules.length && target != styleSheet.cssRules[insertIndex]; insertIndex++) {}
                }

                // HEADER
                var stylesheetName = styleSheet.href.split("/").pop().split("?").shift();
                result.push("-",{
                    label: Locale.$STRF("CreateCssRule", [stylesheetName], "strings_firefile"),
                    nol10n: true
                });

                // BY TAG
                result.push({
                    label: "+" + tag,
                    nol10n: true,
                    command: function() {
                        Firebug.CSSModule.insertRule(styleSheet, tag + "{}", insertIndex);
                        Firebug.currentContext.getPanel("css").updateCascadeView(node);
                    }
                });

                // BY ID
                if(id) {
                    var styledef = tag + "#" + id;
                    result.push({
                        label: "+" + tag + "#" + id,
                        nol10n: true,
                        command: function() {
                            Firebug.CSSModule.insertRule(styleSheet, styledef + "{}", insertIndex);
                            Firebug.currentContext.getPanel("css").updateCascadeView(node);
                        }
                    });
                }

                // BY CLASS
                if(cssclass) {
                    var classes = cssclass.split(" ");
                    for(var i=0;i<classes.length;i++) {
                        result.push({
                            label: "+" + tag + "." + classes[i],
                            nol10n: true,
                            command: function(e) {
                                Firebug.CSSModule.insertRule(styleSheet, this.label.substr(1) + "{}", insertIndex);
                                Firebug.currentContext.getPanel("css").updateCascadeView(node);
                            }
                        });
                    }
                }

				result.push({
					label: "+Custom...",
					nol10n: true,
					command: function() {
						Firebug.CSSModule.insertRule(styleSheet,window.prompt('Please enter custom selector :',tag ) + "{}" , insertIndex);
						Firebug.currentContext.getPanel("css").updateCascadeView(node);
					}
				});

                return result;

            }
        },
        hookIntoCSSPanel: function() {
            var self = this;

			// CREATE STYLESHEET EDITOR HOOK
			var SEPPrototype = Firebug.getPanelType('stylesheet').prototype;
			var SEPOriginal = SEPPrototype.getEditor;
			var SEPRefreshOriginal = SEPPrototype.updateLocation;

            SEPPrototype.updateLocation = function() {
                var result = SEPRefreshOriginal.apply(this, arguments);
                // UPDATE ICON
                self.updateCssPanelIcon();
                return result;
            }

            SEPPrototype.getEditor = function() {
                var result = SEPOriginal.apply(this, arguments);
                if (this.editor) {
                    self.hookIntoCSSEditor(this.editor);
                }
                return result;
            }

			// CREATE CSS HTML PANEL HOOK
            var SHPPrototype = Firebug.getPanelType('css').prototype;
            var SHPOriginal = SHPPrototype.getEditor;
            SHPPrototype.getEditor = function() {
                var result = SHPOriginal.apply(this, arguments);
                if (this.editor) {
                    self.hookIntoCSSEditor(this.editor);
                }
                return result;
            }
        },
        hookIntoCSSEditor: function(editor) {

            // HOOK INTO SAVE EVENT
            var self = this;
            var origEndEditing = editor.endEditing;
            var origBeginEdit = editor.beginEditing;

            editor.beginEditing = function(target, value) {
                Firebug.FireFile.cssEditing = true;
                Firebug.FireFile.cssPreviousValue = value;
                return origBeginEdit.apply(this, arguments);
            }

            editor.endEditing = function(target, value, cancel) {
                Firebug.FireFile.cssEditing = false;

                // IF TIMER IS ALREADY RUNNING
                if(Firebug.FireFile.cssTimer) {
                    // RESTART TIMEOUT
                    clearTimeout(Firebug.FireFile.cssTimer);
                    Firebug.FireFile.cssTimer = Firebug.currentContext.setTimeout(function () { Firebug.FireFile.autoSaveTimer() }, 3000);
                }

                // CHECK IF VALUE WAS CHANGED
                if (value != null && value != Firebug.FireFile.cssPreviousValue) {

                    // GET STYLESHEET
                    var cssRule = Dom.getAncestorByClass(target, "cssRule");
                    var styleRule = Firebug.getRepObject(cssRule);
                    
                    if(styleRule != undefined) {

                        while(styleRule.parentRule != undefined) {
                            styleRule = styleRule.parentRule;
                        }

                        var styleSheet = styleRule.parentStyleSheet;
                        if(styleSheet != undefined) {
                            // CHECK IF STYLE BELONGS TO STYLESHEET OR HTML DOCUMENT
                            if (styleSheet.href != null) {
                                if (self.styleSheetExists(styleSheet.href) === false) {

                                    // ADD TO MODIFIED LIST
                                    self.modifiedStylesheets.push(styleSheet);

                                    // AUTOSAVE IF ALLOWED
                                    var existing_site = Firebug.FireFile.getHrefInAllowedSites(styleSheet.href);
                                    if(existing_site && existing_site.autosave == true) {
                                        Firebug.FireFile.styleSheetStatus[styleSheet.href] = "autosave";

                                        // START NEW TIMEOUT
                                        Firebug.FireFile.cssTimer = Firebug.currentContext.setTimeout(function () { Firebug.FireFile.autoSaveTimer() }, 3000);
                                    }
                                }
                            }
                        }
                    }
                }

                // CSS STYLESHEET EDITOR
                self.updateCssPanelIcon();

                return origEndEditing.apply(this, arguments);
            };
        },
        autoSaveTimer: function() {
            if(Firebug.FireFile.cssEditing) {
                // STOP OLD TIMEOUT
                Firebug.FireFile.cssTimer = Firebug.currentContext.setTimeout(function () { Firebug.FireFile.autoSaveTimer() }, 3000);
            }else{
                // SAVE UNSAVED CHANGES
                for(var i=Firebug.FireFile.modifiedStylesheets.length-1;i>=0;i--) {
                    var existing_site = Firebug.FireFile.getHrefInAllowedSites(Firebug.FireFile.modifiedStylesheets[i].href);
                    if(existing_site && existing_site.autosave) {
                        CssSaver.save(Firebug.FireFile.modifiedStylesheets[i].href);
                    }
                }
            }
        },
        saveAllChanges: function() {
            // SAVE UNSAVED CHANGES
            for(var i=Firebug.FireFile.modifiedStylesheets.length-1;i>=0;i--) {
                var existing_site = Firebug.FireFile.getHrefInAllowedSites(Firebug.FireFile.modifiedStylesheets[i].href);
                if(existing_site) {
                    CssSaver.save(Firebug.FireFile.modifiedStylesheets[i].href);
                }
            }
        },
        styleSheetExists: function(value) {
            for (var i = 0; i < this.modifiedStylesheets.length; i++) {
                if (this.modifiedStylesheets[i].href == value) {
                    return true;
                }
            }
            return false;
        },
        styleSheetIndexByHref: function(value) {
            for (var i = 0; i < this.modifiedStylesheets.length; i++) {
                if (this.modifiedStylesheets[i].href == value) {
                    return i;
                }
            }
            return false;
        },
        clickStatus: function() {

            // OPEN SITES PANEL
            top.Firebug.chrome.selectPanel("html");
            top.Firebug.chrome.selectSidePanel("firefile");
            Firebug.currentContext.getPanel("firefile").select();
        },
        __: function(text) {
            try{
                if (Firebug.FireFile.stringBundle == undefined) {
                    categoryManager.addCategoryEntry("strings_firefile", "chrome://FireFile/locale/firefile.properties", "", false, true);
                    Firebug.FireFile.stringBundle = stringBundleService.createExtensibleBundle("strings_firefile");
                }
                text = Firebug.FireFile.stringBundle.GetStringFromName(text);

                // REPLACE PLACEHOLDERS
                if(arguments.length > 1) {
                    for(var i=1;i<arguments.length;i++) {
                        text = text.replace("$"+i, arguments[i]);
                    }
                }

                return text;
            }catch(ex) {
                Firebug.FireFile.addDebugInfo("Untranslated Text", {text: text});
                return text;
            }
        },
        generateSitesPrefString: function(sites) {
            var siteStrings = new Array();
            var prefString = "";
            for (i in sites) {
                if (sites[i].url && sites[i].code) {
                    siteStrings.push(sites[i].url + ";" + sites[i].code);
                }
            }

            return siteStrings.join("|");

        },
        setStatus: function(img) {
            var button = top.document.getElementById("firefile-button");
            if(button != null) {
                button.style.listStyleImage = "url(chrome://FireFile/skin/status_"+img+".png)";
            }
        },
        filenameFromHref: function(href) {
        	var url_array = href.split("/");
        	var filename = url_array.pop();
        	filename = filename.split("?");
        	filename = filename[0];
        	filename = filename.split("#");
        	filename = filename[0];
        	if(filename[0] == "" || filename[0] == undefined) {
        	    return "index.html";
        	}
        	return filename;
        },
    	writeFile: function(contents, save_path) {
		    // INIT FILE
			var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
			file.initWithPath(save_path);

			// INIT STREAM
			var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);

            try{
    			// WRITE STREAM
    			foStream.init( file, 0x04 | 0x08 | 0x20, 420, 0 );
    			foStream.write(contents, contents.length);
    			foStream.close();
            }catch(exception){
                return false;
            }

			return true;

    	},
        isLoggedIn: function() {
            return (Firebug.getPref("extensions.firefile", "token") != "" && Firebug.getPref("extensions.firefile", "username") != "");
        },
        isServerStylesheetUrl: function(href) {
            if(!this.isLoggedIn()) { return false; }
            var prefix = "http://www.firefile.at/user/" + Firebug.getPref("extensions.firefile", "username") + "/";
            if(href.substr(0, prefix.length) == prefix) { return true; }
            return false;
        },
		getHrefInAllowedSites: function(href) {

		    // ALWAYS ALLOW 'UPLOADING' OF LOCAL FILES
            if(this.isFileLocal(href)) { return true; }
            
            // Allways allow uploading to current firefile user
            if(this.isServerStylesheetUrl(href)) { return true; }

		    // CHECK FOR MATCHING SITE HOST
            var re = new RegExp('^((?:https|http|file)?\://?/[^/]+)', 'im');
            var matches = href.match(re);
            if(!matches) { return false; }
            var css_host = matches[1].toString();

            var sites = this.getSitesArray();
            for (i in sites) {
                if(sites[i].url != "") {
                    if (css_host == sites[i].url.match(re)[1].toString()) {
                        return sites[i];
                    }
                }
            }
            return false;
		},
		getHostFromHref: function(href) {
		    try{
                var re = new RegExp('^((?:https|http|file)?\://?/([^/]+))', 'im');
                var matches = href.match(re);
                return matches[2].toString();
		    }catch(ex){return false;}
		},
		isFileLocal: function(href) {
		    if(href.substr(0,7) == "file://") {
		        return true;
		    }else{
		        return false;
		    }
		},
		updateNotify: function(barid, priority, change, msg, msgOnly) {

            if(!Firebug.FireFile.prefs.enable_notifications) { return false; }

			if(change == undefined) { change = 1; }

			var notifyBox = top.gBrowser.getNotificationBox();

			// CREATE BAR IF NOT EXISTS
			if(notifyBox.getNotificationWithValue(barid) == null) {
				if(change > 0) {
					this.notifyCount = change;
					notifyBox.appendNotification(
						"",
						barid,
						"chrome://firefile/skin/firefile_32.png",
						priority,
						Array(
							{label: Firebug.FireFile.__("NeverShow"), callback: this.onDisableNotify, popup: null}
						)
					);
				}else{
					return false;
				}
			}else{
				this.notifyCount += change;
			}

			// CHECK IF COUNT SMALLER OR EQUAL ZERO
			if(this.notifyCount <= 0) {
				// REMOVE ELEMENT
				this.notifyCount = 0;
				notifyBox.removeNotification(notifyBox.getNotificationWithValue(barid));
			}else{
				// UPDATE LABEL
				var label = "";
				if(msgOnly) {
				    label += Firebug.FireFile.__(msg);
				}else{
				    label += this.notifyCount+" "+Firebug.FireFile.__(msg);
				}

				notifyBox.getNotificationWithValue(barid).label = label;
			}
		},
		onDisableNotify: function() {
		    Firebug.FireFile.prefs.enable_notifications = false;

			var notifyBox = top.gBrowser.getNotificationBox();
			if(notifyBox.getNotificationWithValue("ffnotify") != null) {
				notifyBox.removeNotification(notifyBox.getNotificationWithValue("ffnotify"));
			}
			if(notifyBox.getNotificationWithValue("fferror") != null) {
				notifyBox.removeNotification(notifyBox.getNotificationWithValue("fferror"));
			}
		},
        togglePref: function(name, callback){
            Firebug.setPref("extensions.firefile", name, !this.prefs[name]);
            this.prefs[name] = !this.prefs[name];
            if(callback != undefined) {
                callback.call(this);
            }
        },
        restartFirebug: function(on)
        {
            
            Components.utils.import("resource://gre/modules/Services.jsm");
            Services.obs.notifyObservers(null, "startupcache-invalidate", null);

            var BOOTSTRAP_REASONS = {
                APP_STARTUP     : 1,
                APP_SHUTDOWN    : 2,
                ADDON_ENABLE    : 3,
                ADDON_DISABLE   : 4,
                ADDON_INSTALL   : 5,
                ADDON_UNINSTALL : 6,
                ADDON_UPGRADE   : 7,
                ADDON_DOWNGRADE : 8
            };
            var XPIProviderBP = Components.utils.import("resource://gre/modules/XPIProvider.jsm");
            var id = "firebug@software.joehewitt.com";
            var XPIProvider = XPIProviderBP.XPIProvider;
            var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
            file.persistentDescriptor = XPIProvider.bootstrappedAddons[id].descriptor;

            var t1 = Date.now();
            XPIProvider.callBootstrapMethod(id, XPIProvider.bootstrappedAddons[id].version,
                                    XPIProvider.bootstrappedAddons[id].type, file,
                                    "shutdown", BOOTSTRAP_REASONS.ADDON_DISABLE);
            FBTrace.sysout("shutdown time :" + (Date.now() - t1) + "ms");
            if (!on)
                return;

            t1 = Date.now()
            XPIProvider.callBootstrapMethod(id, XPIProvider.bootstrappedAddons[id].version,
                                    XPIProvider.bootstrappedAddons[id].type, file,
                                    "startup", BOOTSTRAP_REASONS.APP_STARTUP);
            FBTrace.sysout("startup time :" + (Date.now() - t1) + "ms");
        },
        addDebugInfo: function(title, data) {
            if(Firebug.FireFile.prefs.enable_debug_mode) {
                Firebug.Console.log(title);
                for(var key in data) {
                    Firebug.Console.log([key+":", data[key]]);
                }
            }
        }
    });
    
    return Firebug.FireFile;

}});