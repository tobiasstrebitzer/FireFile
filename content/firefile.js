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

	var db = null;

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

			var result = Firebug.FireFile.CssTransformer.getCommentForRule(object.rule);
			if(result !== false) {
				return result.split("\n");
			}
            return [];
        }
    };

    var CSSPropTag = domplate(CSSDomplateBase, {
        tag: DIV({"class": "cssProp focusRow", $disabledStyle: "$prop.disabled",
              $editGroup: "$rule|isEditable",
              $cssOverridden: "$prop.overridden", role : "option"},
			SPAN("&nbsp;&nbsp;&nbsp;&nbsp;"), // Use spaces for indent so, copy to clipboard is nice.
            SPAN({"class": "cssPropName", $editable: "$rule|isEditable"}, "$prop.name"),
            SPAN({"class": "cssColon"}, ":"),
            SPAN({"class": "cssPropValue", $editable: "$rule|isEditable"}, "$prop.value$prop.important"),
            SPAN({"class": "cssSemi"}, ";")
        )
    });

    var CSSRuleTag = TAG("$rule.tag", {rule: "$rule"});

    var CSSImportRuleTag = domplate({
        tag: DIV({"class": "cssRule insertInto focusRow importRule", _repObject: "$rule.rule"},
            "@import &quot;",
            A({"class": "objectLink", _repObject: "$rule.rule.styleSheet"}, "$rule.rule.href"),
            "&quot;;"
        )
    });

    var CSSStyleRuleTag = domplate(CSSDomplateBase, {
        tag: DIV({"class": "cssRule insertInto",
                $cssEditableRule: "$rule|isEditable",
                $editGroup: "$rule|isSelectorEditable",
                _repObject: "$rule.rule",
                "ruleId": "$rule.id", role : 'presentation'},
			DIV({"class": "ruleComment", title: "Comment"}, 
	            FOR("comment", "$rule|getComments",
	            	DIV({"class": "ruleCommentLine"}, "$comment")
	            )
		  	),
            DIV({"class": "cssHead focusRow", role : 'listitem'},
                SPAN({"class": "cssSelector", $editable: "$rule|isSelectorEditable"}, "$rule.selector"), " {"
            ),
            DIV({role : 'group'},
                DIV({"class" : "cssPropertyListBox", _rule: "$rule", role : 'listbox'},
                    FOR("prop", "$rule.props",
                        TAG(CSSPropTag.tag, {rule: "$rule", prop: "$prop"})
                    )
                )
            ),
            DIV({"class": "editable insertBefore", role:"presentation"}, "}")
        )
    });
    
    var FireFileStyleDomPlate = domplate({
        cascadedTag:
            DIV({"class": "a11yCSSView",  role: 'presentation'},
                DIV({role: 'list', 'aria-label' : $STR('aria.labels.style rules') },
                    FOR("rule", "$rules",
                        TAG("$ruleTag", {rule: "$rule"})
                    )
                ),
                DIV({role: "list", 'aria-label' :$STR('aria.labels.inherited style rules')},
                    FOR("section", "$inherited",

                        H1({"class": "cssInheritHeader groupHeader focusRow", role: 'listitem' },
                            SPAN({"class": "cssInheritLabel"}, "$inheritLabel"),
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
          DIV({"class": "cssElementRuleContainer"},
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
            var parentSheet = rule.rule.parentStyleSheet;

			// Return inline styles
			if(parentSheet == undefined) {return "";}

            if(Firebug.FireFile.styleSheetExists(parentSheet.href)) {
                if(Firebug.FireFile.getSiteByHref(parentSheet.href)) {
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
            Firebug.FireFile.saveIconClicked(e.target);
        },
		isFireFile: true
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
		
		downloadIconClicked: function(target) {
			if(typeof(target) == "string") {
				var href = target;
			}else{
				var node = getAncestorByClass(target, "FireFileChangeHook");
				var href = node.getAttribute('styleurl');
			}
			
			if(Firebug.FireFile.styleSheetExists(href)) {
				var index = Firebug.FireFile.styleSheetIndexByHref(href);
				Firebug.FireFile.downloadChange(index);
			}

		},
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
                	var registered_site = Firebug.FireFile.getSiteByHref(href);

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
				FirebugContext.getPanel("firefile").select();
            }
        },
		resetStylesheet: function(href) {
			try{
			var stylesheets = FirebugContext.window.document.styleSheets;
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
				Firebug.Console.log(ex);
				
				
			}
		},
		showContext: function(browser, context) {
			
			// Test db (force init)
			this.initDb();
			
			if(!context) { return; }
			
			// CHECK IF ALLOWED FOR THIS PAGE
			var url = top.gBrowser.currentURI.asciiSpec;
			if(this.hasPrefSitesWithUri(url)) {
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
	
							// Add site to registered sites
							Firebug.FireFile.db.insert({
                                url: site_script,
                                hash: keyholder.innerHTML,
                                label: this.getHostFromHref(site_script),
								host: "http://" + this.getHostFromHref(site_script),
								autosave: 0,
								ftp_host: null,
								ftp_user: null,
								ftp_pass: null,
								ftp_port: null,
								ftp_rdir: null,
								is_ftp: 0
							}, "sites");
							
							// Update status
                            Firebug.FireFile.setStatus("closed");
                            
                            // Open sites panel
                            top.FirebugChrome.selectPanel("html");
                            top.FirebugChrome.selectSidePanel("firefile");
                            FirebugContext.getPanel("firefile").select();
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
		initDb: function() {
			
			this.db = new Firebug.FireFile.FireDb("firefile");

			if(!this.db.exists("sites")) {
				
				// Initialize database
				this.setupDatabase();
				
				// Install sample data (TODO: Disable)
				this.installSampleData();
			}
			
		},
		setupDatabase: function() {
			this.db.create("sites", {
				id: {type: "INTEGER", autoincrement: true, primary_key: true},
				label: {type: "TEXT"},
				hash: {type: "TEXT"},
				url: {type: "TEXT"},
				host: {type: "TEXT"},
				autosave: {type: "INTEGER"},
				ftp_host: {type: "TEXT"},
				ftp_user: {type: "TEXT"},
				ftp_pass: {type: "TEXT"},
				ftp_port: {type: "INTEGER"},
				ftp_rdir: {type: "TEXT"},
				is_ftp: {type: "INTEGER"}
			}, true);
		},
		installSampleData: function() {
			
			// Test Site 1
			this.db.insert({label: "MacTobi", url: "http://mactobi.com/firefile/firefile.php", host: "mactobi.com", hash: "c566df8ba7d4a07489a32396b7b63907", autosave: 0, is_ftp: 0});
			
			// Test Site 2
			this.db.insert({label: "FireFile", url: "http://www.strebitzer.at/firefile", host: "www.strebitzer.at/firefile", hash: "", autosave: 0, ftp_host: "login-14.hoststar.at", ftp_user: "", ftp_pass: "", ftp_port: 21, ftp_rdir: "html/firefile", is_ftp: 1});
			
			// Test Site 3
			this.db.insert({label: "Cherrybomb", url: "http://www.strebitzer.at/cherrybomb", host: "www.strebitzer.at/cherrybomb", hash: "", autosave: 0, ftp_host: "login-14.hoststar.at", ftp_user: "", ftp_pass: "", ftp_port: 21, ftp_rdir: "html/cherrybomb", is_ftp: 1});

		},
        initialize: function() {
	
			// Initialize database
			//this.initDb();

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
		hasPrefSitesWithUri: function(url) {
			var count = Firebug.FireFile.db.select("*").from("sites").where("host = '" + url + "' OR '" + url + "' LIKE host || '%'").count();
			return count > 0;			
		},
		changesList: {},
        getSitesArray: function() {
			return Firebug.FireFile.db.select("*").from("sites").getResults();
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
			var HtmlCssSelectOrig = HtmlCssPrototype.select;
			
			HtmlCssPrototype.select = function() {
				
                // Dispatch original event
                var result = HtmlCssSelectOrig.apply(this, arguments);

				// Add Stylesheet if not exists
				if(this.document.styleSheets[this.document.styleSheets.length - 1].href != "chrome://firefile/content/firefile.css") {
					Firebug.FireFile.loadCss("chrome://FireFile/content/firefile.css", this.document);
				}

				if(this.template.isFireFile == undefined) {
					this.template = FireFileStyleDomPlate;
				}

				return result;
			};
			
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
                    Firebug.FireFile.cssTimer = FirebugContext.setTimeout(function () { Firebug.FireFile.autoSaveTimer() }, 3000);
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
									var site = Firebug.FireFile.getSiteByStylesheet(styleSheet);
									
									if(site) {
										// ADD TO MODIFIED LIST
										self.modifiedStylesheets.push(styleSheet);
										
										// AUTOSAVE IF ALLOWED
	                                    if(site.autosave == true) {
	                                        Firebug.FireFile.styleSheetStatus[styleSheet.href] = "autosave";

	                                        // START NEW TIMEOUT
	                                        Firebug.FireFile.cssTimer = FirebugContext.setTimeout(function () { Firebug.FireFile.autoSaveTimer() }, 3000);
	                                    }
										
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
                Firebug.FireFile.cssTimer = FirebugContext.setTimeout(function () { Firebug.FireFile.autoSaveTimer() }, 3000);
            }else{
                // SAVE UNSAVED CHANGES
                for(var i=Firebug.FireFile.modifiedStylesheets.length-1;i>=0;i--) {
                    var existing_site = Firebug.FireFile.getSiteByHref(Firebug.FireFile.modifiedStylesheets[i].href);
                    if(existing_site && existing_site.autosave) {
                        Firebug.FireFile.saveIconClicked(Firebug.FireFile.modifiedStylesheets[i].href);
                    }
                }
            }
        },
        saveAllChanges: function() {
            // SAVE UNSAVED CHANGES
            for(var i=Firebug.FireFile.modifiedStylesheets.length-1;i>=0;i--) {
                var existing_site = Firebug.FireFile.getSiteByHref(Firebug.FireFile.modifiedStylesheets[i].href);
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
        downloadChange: function(index) {
                            
            // GET CONTENTS
			try{
				// GET STYLESHEET AND FILENAME
                var styleSheet = Firebug.FireFile.modifiedStylesheets[index];    				
                var contents = Firebug.FireFile.CssTransformer.generateCSSContents(styleSheet, Firebug.FireFile.prefs.compress_css);
                var save_path = Firebug.FireFile.getDownloadPathDialog(this.filenameFromHref(styleSheet.href));
            }catch(exception) {
				// RETURN ON ERROR
                return false;
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
			
			if(site.is_ftp) {
				Firebug.FireFile.sendFileFTP(index, contents, href, site, filetype, successEvent, errorEvent);
			}else{
				Firebug.FireFile.sendFileScript(index, contents, href, site, filetype, successEvent, errorEvent);
			}
		},
		sendFileFTP: function(index, contents, href, site, filetype, successEvent, errorEvent) {
			try{
				Firebug.Console.log("send ftp");
			
				// Get Stylesheet data and guess filename
				var fileName = Firebug.FireFile.filenameFromHref(href);
				var fileHost = Firebug.FireFile.getHostFromHref(href);
				var fileUrl = href.replace(fileName, "");
				var fileUri = fileUrl.replace("http://" + fileHost + "/", ""); // todo: do this in one go
				var filePath = site.ftp_rdir + fileUri;
			
				Firebug.Console.log({
					"fileName": fileName,
					"fileHost": fileHost,
					"fileUrl": fileUrl,
					"fileUri": fileUri,
					"filePath": filePath
				});
				
				// Save local copy of file
				var fileHandle = Firebug.FireFile.DataUtils.saveTemporaryFile(fileName, contents);
					
				Firebug.FireFile.DataUtils.saveFileFtp(site, filePath, fileName, fileHandle, 
					// onError
					function(error) {
						Firebug.Console.log(error);
					},
					// onSuccess
					function(success) {
						Firebug.Console.log(success);
					}
				);
			}catch(ex) {
				Firebug.Console.log(ex);
			}
		},
		sendFileScript: function(index, contents, href, site, filetype, successEvent, errorEvent) {
            
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
            xmlhttp.send(filetype + "=" + window.btoa(contents) + "&file=" + window.btoa(href) + "&action=save&code=" + site.hash + "&index="+index);
            
		    if(Firebug.FireFile.prefs.enable_debug_mode) {
		        Firebug.Console.log("params:");
		        Firebug.Console.log({
		            siteurl: site.url,
		            contents: contents,
		            href: href
		        });
		        Firebug.Console.log("request:");
		        Firebug.Console.log(filetype + "=" + window.btoa(contents) + "&file=" + window.btoa(href) + "&action=save&code=" + site.hash + "&index="+index);
		    }
            
            return true;

        },
		onSaveSuccess: function(success, styleindex, msg) {
			Firebug.FireFile.setStatus("closed");
			Firebug.FireFile.updateNotify("fferror", 8, -1000, msg);
			Firebug.FireFile.updateNotify("ffnotify", 4, 1, msg);
		},
		getStylesheetsBySite: function(site) {
			var stylesheets = [];
			
			// Generate needle
			var needle = this.formatUrl(site.host);
			
			for (var i=0; i < this.modifiedStylesheets.length; i++) {
				var search = this.formatUrl(this.modifiedStylesheets[i].href);
				if(search.substr(0, needle.length) == needle) {
					stylesheets.push(this.modifiedStylesheets[i]);
				}
			};
			return stylesheets;
		},
		formatUrl: function(url) {
			if(url.substr(0,7) != "http://") {
				url = "http://" + url;
			}
			return url;
		},
		getSiteByStylesheet: function(stylesheet) {
			return this.getSiteByHref(stylesheet.href);
		},
		getSiteByHref: function(href) {
			
			var css_host = this.getHostFromHref(href);
			
		    // CHECK FOR MATCHING SITE HOST
            if(!css_host) { return false; }
			Firebug.Console.log(css_host);
			Firebug.Console.log(href);
			
			// Query sites table
			var site = Firebug.FireFile.db.select("*").from("sites").where("host LIKE 'http://" + css_host + "%'").fetch();

			if(site.length == 0) {
				return false;
			}else{
				return site;
			}

		},
		/* delete
		getHrefInAllowedSites: function(href) {
		    
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
		}, */
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
