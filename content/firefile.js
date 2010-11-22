/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Initial Developer of the Original Code is Tobias Strebitzer.
 *
 * Portions created by the Initial Developer are Copyright (C) 2009 by
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Tobias Strebitzer <tobias.strebitzer@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2.0 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

FBL.ns(function() { with(FBL) {

    // Register FireFile string bundles.
    const categoryManager = CCSV("@mozilla.org/categorymanager;1", "nsICategoryManager");
    const stringBundleService = CCSV("@mozilla.org/intl/stringbundle;1", "nsIStringBundleService");
    const FireFilePrefDomain = "extensions.firefile";
    const PromptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);

    var CSSDomplateBase = {
        isEditable: function(rule)
        {
            return !rule.isSystemSheet;
        },
        isSelectorEditable: function(rule)
        {
            return rule.isSelectorEditable && this.isEditable(rule);
        },
        getComments: function(object) {
			if(!Firebug.FireFile.prefs.display_comments) { 
				return [];
			}
			try{
			var result = Firebug.FireFile.CssTransformer.getCommentForRule(object.rule);
			if(result !== false) {
				return result.split("\n");
			}
			}catch(ex){
				Firebug.Console.log(ex);
			}
            return [];
        }
    };

    var CSSPropTag = domplate(CSSDomplateBase, {
        tag: DIV({class: "cssProp focusRow", $disabledStyle: "$prop.disabled",
              $editGroup: "$rule|isEditable",
              $cssOverridden: "$prop.overridden", role : "option"},
            SPAN({class: "cssPropName", $editable: "$rule|isEditable"}, "$prop.name"),
            SPAN({class: "cssColon"}, ":"),
            SPAN({class: "cssPropValue", $editable: "$rule|isEditable"}, "$prop.value$prop.important"),
            SPAN({class: "cssSemi"}, ";")
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

    var CSSStyleRuleTag = domplate(CSSDomplateBase, {
        tag: DIV({class: "cssRule insertInto",
                $cssEditableRule: "$rule|isEditable",
                $editGroup: "$rule|isSelectorEditable",
                _repObject: "$rule.rule",
                "ruleId": "$rule.id", role : 'presentation'},
			DIV({class: "ruleComment", title: "Comment"}, 
	            FOR("comment", "$rule|getComments",
	            	DIV({"class": "ruleCommentLine"}, "$comment")
	            )
		  	),
            DIV({class: "cssHead focusRow", role : 'listitem'},
                SPAN({class: "cssSelector", $editable: "$rule|isSelectorEditable"}, "$rule.selector"), " {"
            ),
            DIV({role : 'group'},
                DIV({class : "cssPropertyListBox", role : 'listbox'},
                    FOR("prop", "$rule.props",
                        TAG(CSSPropTag.tag, {rule: "$rule", prop: "$prop"})
                    )
                )
            ),
            DIV({class: "editable insertBefore", role:"presentation"}, "}")
        )
    });
    
    var FireFileStyleDomPlate = domplate({
        cascadedTag:
            DIV({"class": "a11yCSSView",  role : 'presentation'},
                DIV({role : 'list', 'aria-label' : $STR('aria.labels.style rules') },
                    FOR("rule", "$rules",
                        TAG("$ruleTag", {rule: "$rule"})
                    )
                ),
                DIV({role : "list", 'aria-label' :$STR('aria.labels.inherited style rules')},
                    FOR("section", "$inherited",

                        H1({class: "cssInheritHeader groupHeader focusRow", role : 'listitem' },
                            SPAN({class: "cssInheritLabel"}, "$inheritLabel"),
                            TAG(FirebugReps.Element.shortTag, {object: "$section.element"})
                        ),
                        DIV({role : 'group'},
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
                  DIV({class: "$rule|isTouched", onclick: "$saveChange", title: $STR("ClickToSaveChanges", "strings_firefile")}),
                  TAG(FirebugReps.SourceLink.tag, {object: "$rule.sourceLink"})
              )
          ),
        getHref: function(rule) {
            try{
                return rule.rule.parentStyleSheet.href;
            }catch(ex) {
                return "";
            }
        },
        isTouched: function(rule) {
            try{
                var parentSheet = rule.rule.parentStyleSheet;
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
            }catch(ex) {
                // alert(ex);
            }
            return "";
        },
        saveChange: function(e) {
            Firebug.FireFile.saveIconClicked(e.target);
        }
    });

    Firebug.FireFile = extend(Firebug.Module, {

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
			remove_empty_styles: true,
			autofix_css3: true,
			compress_css: false,
			enable_debug_mode: false
		},
		
		// TIMEOUT HANDLING
		cssPreviousValue: "",
		cssEditing: false,
		
		saveIconClicked: function(target) {
            try{
                if(typeof(target) == "string") {
                    var href = target;
                }else{
                    var node = getAncestorByClass(target, "FireFileChangeHook");
                    var href = node.getAttribute('styleurl');
                }
                if(Firebug.FireFile.styleSheetExists(href)) {
                    // GET STYLESHEET DATA
                    var index = Firebug.FireFile.styleSheetIndexByHref(href);
                    var stylesheet = Firebug.FireFile.modifiedStylesheets[index];

                    var contents = Firebug.FireFile.CssTransformer.generateCSSContents(Firebug.FireFile.modifiedStylesheets[index], Firebug.FireFile.prefs.compress_css);
					if(contents === false) {throw "Unable to create css file";}
					
                    var href = Firebug.FireFile.modifiedStylesheets[index].href;
                    var filetype = "stylesheet";
                	var registered_site = Firebug.FireFile.getHrefInAllowedSites(href);                    
                    Firebug.FireFile.sendFile(index, contents, href, registered_site, filetype, function(e) {
                        // ON SUCCESS
                        Firebug.FireFile.styleSheetStatus[href] = "done";
                        Firebug.FireFile.modifiedStylesheets.splice(index,1);            
                        // CALL REFRESHER
                        Firebug.FireFile.visualUpdateHandler(true);
                    }, function(e) {
                        // ON ERROR
                        Firebug.FireFile.updateNotify("fferror", 8, 1, "FileErrors");
                        Firebug.FireFile.setStatus("closed");
                        Firebug.FireFile.styleSheetStatus[href] = "error";
                        
                        // CALL REFRESHER
                        Firebug.FireFile.visualUpdateHandler(true);
                        return false;
                    });
                    Firebug.FireFile.styleSheetStatus[href] = "saving";
                    // CALL REFRESHER
                    Firebug.FireFile.visualUpdateHandler();
                }
            }catch(ex){
                // ERROR OUTPUT WHEN NOT IN REGISTERED SITES
                Firebug.FireFile.updateNotify("fferror", 8, 1, "FileErrors");
                Firebug.FireFile.setStatus("closed");
                Firebug.FireFile.styleSheetStatus[href] = "error";
                // CALL REFRESHER
                Firebug.FireFile.visualUpdateHandler();
				
			    if(Firebug.FireFile.prefs.enable_debug_mode) {
			        Firebug.Console.log(ex);
			    }
                return false;
            }  
		},
		initContext: function(context, persistedState) {
	    },
		showContext: function(browser, context) {

			// DB tests
			try{
				var db = new Firebug.FireFile.FireDb("firefile");
				
				var query = db.select("name").from("models").getQuery();
				
				Firebug.Console.log(query);
				
				// Test
				// db.getHandle().executeSimpleSQL("INSERT INTO models (name) VALUES ('test');");
				
			}catch(ex) {
				Firebug.Console.log(ex);
			}

			Firebug.Console.log(db);
			
			return false;
			
			if(!context) { return; }
			
			// CHECK IF ALLOWED FOR THIS PAGE
			var prePath = top.gBrowser.currentURI.prePath;
			if(this.hasPrefSitesWithUri(prePath)) {
				this.enableFireFile();
			}else{
				this.disableFireFile();
									
                // CHECK FOR FIREFILE PAGE
 				var site_script = FirebugContext.name;
                var keyholder = FirebugContext.global.document.getElementById("firefile-key-holder");
				
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
                            top.FirebugChrome.selectPanel("html");
                            top.FirebugChrome.selectSidePanel("firefile");
                            FirebugContext.getPanel("firefile").select();
                        }
                    }
                }

			}

			// STYLE SUB PANEL HOOKS
			try{
				if(!FirebugContext.getPanel("css")) {
					Firebug.chrome.switchToPanel(context, "html");
				}
				FirebugContext.getPanel("css").template = FireFileStyleDomPlate;
	            this.loadCss("chrome://FireFile/content/firefile.css", FirebugContext.getPanel("css").document);
			}catch(ex){
				// Firebug.Console.log(ex);
			}
			
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

			// Setup CSS View
			/*Firebug.Console.log(FirebugContext.getPanel("css"));
			FirebugContext.getPanel("css").template = FireFileStyleDomPlate;
			this.loadCss("chrome://FireFile/content/firefile.css", FirebugContext.getPanel("css").document);*/

			// Setup System Hooks
            this.hookIntoHtmlContext();
            this.hookIntoCSSPanel();
            this.modifiedStylesheets = new Array();
            this.styleSheetStatus = new Array();
            
            // SETUP PREFERENCES
            for(var key in this.prefs) {
                this.prefs[key] = Firebug.getPref(FireFilePrefDomain, key);
            }
            
			// OVERRIDE INSPECTOR FUNCTION
			Firebug.FireFile.origInspector = Firebug.Inspector.startInspecting;
            Firebug.Inspector.startInspecting = function() {
                Firebug.FireFile.origInspector.apply(this, arguments);
                if(Firebug.FireFile.prefs.inspector_switch_css) { 
                    top.FirebugChrome.selectPanel("html");
                    top.FirebugChrome.selectSidePanel("css");
                }
            }
            
            // OVERRIDE CONTEXT INSPECTOR FUNCTION
			Firebug.FireFile.origContextInspector = Firebug.Inspector.inspectFromContextMenu;
            Firebug.Inspector.inspectFromContextMenu = function() {
                Firebug.FireFile.origContextInspector.apply(this, arguments);
                if(Firebug.FireFile.prefs.inspector_switch_css) { 
                    top.FirebugChrome.selectPanel("html");
                    top.FirebugChrome.selectSidePanel("css");
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
        getActiveWindow: function() {
            return FirebugChrome.getCurrentBrowser()._contentWindow;
        },
		hasPrefSitesWithUri: function(prePath) {
			// SHORTER WAY
			if(Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch).getCharPref("extensions.firefile.sites").indexOf(prePath) != -1) {
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
                var sitesString = Firebug.getPref(FireFilePrefDomain, "sites");
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
            Firebug.setPref(FireFilePrefDomain, "sites", sitesRows.join(";"));
            
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
                FirebugContext.getPanel("css").updateSelection(FirebugContext.getPanel("css").selection);
                FirebugContext.getPanel("firefile").select();
                return;
            }
            
            // PERFORM VISUAL UPDATES
            switch(panel.name) {
                case "stylesheet":
                    this.updateCssPanelIcon();
                    break;
                case "html":
                    if(sidePanel.name == "css") {
                        FirebugContext.getPanel("css").updateSelection(FirebugContext.getPanel("css").selection);
                    }else if(sidePanel.name == "firefile") {
                        FirebugContext.getPanel("firefile").select();
                    }
                    break;
            }
        },
        updateCssPanelIcon: function() {
            if(FirebugContext.getPanel('stylesheet').location != undefined) {
                var href = FirebugContext.getPanel('stylesheet').location.href;
                if(this.styleSheetExists(href)) {
                    removeClass($("ffCssPanelSaveButton"), "disabled");
                    removeClass($("ffCssPanelSaveButton"), "error");
                    removeClass($("ffCssPanelSaveButton"), "autosave");
                    removeClass($("ffCssPanelSaveButton"), "saving");
                    removeClass($("ffCssPanelSaveButton"), "done");
                    if(Firebug.FireFile.styleSheetStatus[href] != undefined) {
                        setClass($("ffCssPanelSaveButton"), Firebug.FireFile.styleSheetStatus[href]);
                    }
                }else{
                    setClass($("ffCssPanelSaveButton"), "disabled");
                }
            }
        },
        saveCurrentStylesheet: function() {
            var href = FirebugContext.getPanel('stylesheet').location.href;
            if(this.styleSheetExists(href)) {
                this.saveIconClicked(href);
            }
        },
        hookIntoHtmlContext: function() {
            
            // HOOK INTO HTML CONTEXT MENU
            var HtmlCssPrototype = Firebug.getPanelType('css').prototype;
			var HtmlCssContextOrig = HtmlCssPrototype.getContextMenuItems;
            HtmlCssPrototype.getContextMenuItems = function() {
                
                // PRE
                var result = HtmlCssContextOrig.apply(this, arguments);
                
                // GET NODES AND TAGS
                var node = FirebugContext.getPanel("html").selection;
                var tag = node.tagName.toLowerCase();
                var id = node.getAttribute("id");
                var cssclass = node.getAttribute("class");

                if(arguments[0] == undefined) {
                    var styleSheet = FirebugContext.getPanel("stylesheet").selected;
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
                    label: $STRF("CreateCssRule", [stylesheetName], "strings_firefile"),
                    nol10n: true
                });
                
                // BY TAG
                result.push({
                    label: "+" + tag,
                    nol10n: true,
                    command: function() {
                        Firebug.CSSModule.insertRule(styleSheet, tag + "{}", insertIndex);
                        FirebugContext.getPanel("css").updateCascadeView(node);
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
                            FirebugContext.getPanel("css").updateCascadeView(node);
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
                                FirebugContext.getPanel("css").updateCascadeView(node);
                            }
                        });
                    } 
                }

				result.push({
					label: "+Custom...",
					nol10n: true,
					command: function() {
						Firebug.CSSModule.insertRule(styleSheet,window.prompt('Please enter custom selector :',tag ) + "{}" , insertIndex);
						FirebugContext.getPanel("css").updateCascadeView(node);
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
                if(Firebug.FireFile.cssTimer) {
                    // RESTART TIMEOUT
                    clearTimeout(Firebug.FireFile.cssTimer);
                    Firebug.FireFile.cssTimer = FirebugContext.setTimeout("Firebug.FireFile.autoSaveTimer()", 3000);
                }
                       
                // CHECK IF VALUE WAS CHANGED
                if (value != null && value != Firebug.FireFile.cssPreviousValue) {
                    
                    // GET STYLESHEET
                    var styleRule = Firebug.getRepObject(target);
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
                                        Firebug.FireFile.cssTimer = FirebugContext.setTimeout("Firebug.FireFile.autoSaveTimer()", 3000);
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
                Firebug.FireFile.cssTimer = FirebugContext.setTimeout("Firebug.FireFile.autoSaveTimer()", 3000);
            }else{
                // SAVE UNSAVED CHANGES
                for(var i=Firebug.FireFile.modifiedStylesheets.length-1;i>=0;i--) {
                    var existing_site = Firebug.FireFile.getHrefInAllowedSites(Firebug.FireFile.modifiedStylesheets[i].href);
                    if(existing_site && existing_site.autosave) {
                        Firebug.FireFile.saveIconClicked(Firebug.FireFile.modifiedStylesheets[i].href);
                    }
                }
            }
        },
        saveAllChanges: function() {
            // SAVE UNSAVED CHANGES
            for(var i=Firebug.FireFile.modifiedStylesheets.length-1;i>=0;i--) {
                var existing_site = Firebug.FireFile.getHrefInAllowedSites(Firebug.FireFile.modifiedStylesheets[i].href);
                if(existing_site) {
                    Firebug.FireFile.saveIconClicked(Firebug.FireFile.modifiedStylesheets[i].href);
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
            top.FirebugChrome.selectPanel("html");
            top.FirebugChrome.selectSidePanel("firefile");
            FirebugContext.getPanel("firefile").select();
        },
        __: function(msg) {
            try{
                if (Firebug.FireFile.stringBundle == undefined) {
                    categoryManager.addCategoryEntry("strings_firefile", "chrome://FireFile/locale/firefile.properties", "", false, true);
                    Firebug.FireFile.stringBundle = stringBundleService.createExtensibleBundle("strings_firefile");
                }
                msg = Firebug.FireFile.stringBundle.GetStringFromName(msg);
                
                // REPLACE PLACEHOLDERS
                if(arguments.length > 1) {
                    for(var i=1;i<arguments.length;i++) {
                        msg = msg.replace("$"+i, arguments[i]);
                    }
                }
                
                return msg;
            }catch(ex) {
			    if(Firebug.FireFile.prefs.enable_debug_mode) {
			        Firebug.Console.log(ex);
			    }
                return msg;
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
            document.getElementById("firefile-status-image").src = "chrome://FireFile/skin/status_" + img + ".png";
        },
        encode64: function(inp) {
            var key = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
            var chr1,
            chr2,
            chr3,
            enc3,
            enc4,
            i = 0,
            out = "";
            while (i < inp.length) {
                chr1 = inp.charCodeAt(i++);
                if (chr1 > 127) chr1 = 88;
                chr2 = inp.charCodeAt(i++);
                if (chr2 > 127) chr2 = 88;
                chr3 = inp.charCodeAt(i++);
                if (chr3 > 127) chr3 = 88;
                if (isNaN(chr3)) {
                    enc4 = 64;
                    chr3 = 0;
                } else enc4 = chr3 & 63
                if (isNaN(chr2)) {
                    enc3 = 64;
                    chr2 = 0;
                } else enc3 = ((chr2 << 2) | (chr3 >> 6)) & 63
                out += key.charAt((chr1 >> 2) & 63) + key.charAt(((chr1 << 4) | (chr2 >> 4)) & 63) + key.charAt(enc3) + key.charAt(enc4);
            }
            return encodeURIComponent(out);
        },
        downloadChange: function(index) {
                            
            // GET CONTENTS
            if(index == -1) {
                // HTML CONTENTS
                var contents = Firebug.FireFile.generateHTMLContents();
                var save_path = Firebug.FireFile.getDownloadPathDialog(this.filenameFromHref(this.getActiveWindow().location.href));
            }else{
                try{
                    // GET STYLESHEET AND FILENAME
                    var styleSheet = Firebug.FireFile.modifiedStylesheets[index];    				
                    var contents = Firebug.FireFile.CssTransformer.generateCSSContents(styleSheet, Firebug.FireFile.prefs.compress_css);
                	var save_path = Firebug.FireFile.getDownloadPathDialog(this.filenameFromHref(styleSheet.href));
                }catch(exception) {
                    // RETURN ON ERROR
                    return false;
                }
            }
        	
    	    // EXIT IF NO FILE SPECIFIED
            if(!save_path) { return false; }
            if(contents === false) { return false; }
            
            // WRITE FILE TO DISK
            if(Firebug.FireFile.writeFile(contents, save_path)) {
    			// NOTIFY USER
    			Firebug.FireFile.updateNotify("ffnotify", 4, 1, "FileSaveAsSuccess", true);
            }else{
                Firebug.FireFile.updateNotify("fferror", 8, 1, "FileErrors");
                Firebug.FireFile.setStatus("closed");
            }

        },
        filenameFromHref: function(href) {
        	var url_array = href.split("/");
        	var filename = url_array.pop();
        	filename = filename.split("?");
        	filename = filename[0];
        	filename = filename.split("#");
        	filename = filename[0];
        	if(filename[0] == "" || filename[0] == undefined) {
        	    return "index.html";
        	}
        	return filename;
        },
    	writeFile: function(contents, save_path) {
		    // INIT FILE
			var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			file.initWithPath(save_path);

			// INIT STREAM
			var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
			
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
    	getDownloadPathDialog: function(defaultName) {
    		// INIT FILEPICKER
    		var nsIFilePicker = Components.interfaces.nsIFilePicker;
    		var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    		fp.init(window, Firebug.FireFile.__("SaveDialogTitle"), nsIFilePicker.modeSave);
    		fp.appendFilter(Firebug.FireFile.__("SaveDialogStylesheet"),"*.css");
    		fp.defaultExtension = "css";		
    		fp.defaultString = defaultName;

    		// SHOW FILEPICKER
    		var res = fp.show();

    		// HANDLE RESPONSE
    		if(res != nsIFilePicker.returnOK && res != nsIFilePicker.returnReplace) { return false; }
	        
	        // GET FILENAME
	        return fp.file.path;  
    	},
		sendFile: function(index, contents, href, site, filetype, successEvent, errorEvent) {
            
            // START TRANSFER
            Firebug.FireFile.setStatus("open");

            // POST TO SERVER
            xmlhttp = new XMLHttpRequest();
			xmlhttp.overrideMimeType('text/xml');
			xmlhttp.id = "change_request_"+index;
            xmlhttp.open("POST", site.url, true);
            xmlhttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            xmlhttp.overrideMimeType('text/xml');

			// SETUP TRANSFER
			xmlhttp.onreadystatechange = function(e) {
				var xmlhttp = e.currentTarget;				
				// DEBUG
				try{
				    if(Firebug.FireFile.prefs.enable_debug_mode) {
				        Firebug.Console.log("response ["+xmlhttp.readyState+"]:");
				        Firebug.Console.log(xmlhttp.responseText);
				    }
				}catch(ex){ /* DO NOTHING */ }
				
				if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
					// GET XML RESPONSE
					var status = xmlhttp.responseXML.getElementsByTagName("firefilestatus")[0];
					
					// INVALID RESPONSE
					if(status == undefined) {
					    // ANALYSE ERROR
                        if(xmlhttp.responseText == "<?xml version='1.0' encoding='ISO-8859-1'?>invalid_file_extension") {
                            var msg = "VersionError";
                        }else{
                            var msg = "ServerError";
                        }
                        
                        // GET INDEX FROM REQUEST ID
                        var styleindex = xmlhttp.id.split("change_request_").join("");
                        
                        // THROW ERROR
						Firebug.FireFile.onSaveError.call(Firebug.FireFile, false, styleindex, msg);
						if(errorEvent != undefined) {
							errorEvent.call(Firebug.FireFile, false, styleindex, msg);
						}
                        
					    return false;
					}
					
					// READ RESPONSE
					var version = status.getAttribute("version");
					var success = status.getAttribute("success");
					var msg = status.getAttribute("msg");
					var styleindex = parseInt(status.getAttribute("styleindex"));
					
					if(success == "true") {
                        Firebug.FireFile.onSaveSuccess.call(Firebug.FireFile, success, styleindex, msg);   
						if(successEvent != undefined) {
							successEvent.call(Firebug.FireFile, success, styleindex, msg);
						}
					}else{
						Firebug.FireFile.onSaveError.call(Firebug.FireFile, success, styleindex, msg);
						if(errorEvent != undefined) {
							errorEvent.call(Firebug.FireFile, success, styleindex, msg);
						}
					}

				}
			}
            
            // FIX HREF
            var qpos = href.search(/\?/);
            if(qpos !== false && qpos != -1) {
                href = href.substr(0, qpos);
            }
            
            // START TRANSFER
            xmlhttp.send(filetype + "=" + this.encode64(contents) + "&file=" + this.encode64(href) + "&action=save&code=" + site.hash + "&index="+index);
            
		    if(Firebug.FireFile.prefs.enable_debug_mode) {
		        Firebug.Console.log("params:");
		        Firebug.Console.log({
		            siteurl: site.url,
		            contents: contents,
		            href: href
		        });
		        Firebug.Console.log("request:");
		        Firebug.Console.log(filetype + "=" + this.encode64(contents) + "&file=" + this.encode64(href) + "&action=save&code=" + site.hash + "&index="+index);
		    }
            
            return true;

        },
        generateHTMLContents: function() {
            // GET DOM DOCUMENT
            var doc = FirebugChrome.getCurrentBrowser()._contentWindow.document;
            var retVal = "";
            
            // GENERATE DOCTYPE
            // <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
            var doctype = doc.doctype;
            if(doctype != null) {
                var publicId = doctype.publicId;
                var systemId = doctype.systemId;
                retVal += '<!DOCTYPE html PUBLIC "'+publicId+'" "'+systemId+'">\n';
            }
            
            // GENERATE HTML (HEAD+BODY)
            retVal += "<html>";
            retVal += doc.documentElement.innerHTML;
            retVal += "</html>";
            
            // REMOVE FIREBUG STUFF
            // <div firebugversion="1.5.0" style="display: none;" id="_firebugConsole"></div>
            // <style type="text/css" charset="utf-8">...firebugCanvas {...</style> 
            retVal = retVal.replace(/<div firebugversion[^>]+><\/div>/, "");
            retVal = retVal.replace(/<style type=\"text\/css\" charset=\"utf-8\">\/\* See license\.txt for terms of usage \*\/[^<]+<\/style>/, "");
            
            return retVal;
        },
		onSaveSuccess: function(success, styleindex, msg) {
			Firebug.FireFile.setStatus("closed");
			Firebug.FireFile.updateNotify("fferror", 8, -1000, msg);
			Firebug.FireFile.updateNotify("ffnotify", 4, 1, msg);
		},
		getHrefInAllowedSites: function(href) {
		    
		    // ALWAYS ALLOW 'UPLOADING' OF LOCAL FILES
            if(this.isFileLocal(href)) { return true; }
		    
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
		onSaveError: function(success, styleindex, msg) {
			Firebug.FireFile.setStatus("closed");
			Firebug.FireFile.updateNotify("fferror", 8, 1, msg);
		},
		updateNotify: function(barid, priority, change, msg, msgOnly) {

            if(!Firebug.FireFile.prefs.enable_notifications) { return false; }
			
			if(change == undefined) { change = 1; }

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
            Firebug.setPref(FireFilePrefDomain, name, !this.prefs[name]);
            this.prefs[name] = !this.prefs[name];
            if(callback != undefined) {
                callback.call(this);
            }
        }
    });

    Firebug.registerModule(Firebug.FireFile);

}});
