/* See license.txt for terms of usage */

define([
    "firebug/lib/object",
    "firebug/lib/trace",
    "firebug/lib/xpcom",
    "firebug/lib/dom",
    "firebug/lib/domplate",
    "firebug/lib/locale",
],
function(Obj, FBTrace, Xpcom, Dom, Domplate, Locale) {
    
with (Domplate) {

    /* CHANGE PANEL */
    const PromptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
    const FireFilePrefDomain = "extensions.firefile";

    var CSSDomplateBase = {
        isEditable: function(rule)
        {
            return !rule.isSystemSheet;
        },
        isSelectorEditable: function(rule)
        {
            return rule.isSelectorEditable && this.isEditable(rule);
        }
    };
    
    var FireFileChangesTags = domplate({
        styleSheetTag:
            DIV({class: "cssChangesTopContainer"},
                DIV({class: "cssChangesContainer FireFileChangeHook", styleurl: "$rule.href"},
                    SPAN({class: "fireFileCancelIcon", onclick: "$cancelChange", title: Locale.$STR("ClickToCancelChanges", "strings_firefile")}),
					SPAN({class: "$rule|isTouched", onclick: "$saveChange", title: Locale.$STR("ClickToSaveChanges", "strings_firefile")}),
                    TAG(FirebugReps.SourceLink.tag, {object: "$rule"}),
                    SPAN({class: "cssChangesPath"}, 
                        "$rule.href"
                    )
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
                var parentSheet = rule;
                if(Firebug.FireFile.styleSheetExists(parentSheet.href)) {
                    var classes = [];
                    classes.push("fireFileSaveIcon");
                    if(Firebug.FireFile.styleSheetStatus[parentSheet.href] != undefined) {
                        classes.push(Firebug.FireFile.styleSheetStatus[parentSheet.href]);
                    }
                    return classes.join(" ");
                }else{
                    return "";
                }
            }catch(ex) {
                return "";
            }
        },
        saveChange: function(e) {
            Firebug.FireFile.saveIconClicked(e.target);
        },
        cancelChange: function(e) {
            var node = Dom.getAncestorByClass(e.target, "FireFileChangeHook");
            var href = node.getAttribute('styleurl');

			// Destroy the changes (FireFile)
			Firebug.FireFile.destroyChanges(href);
			
			// Reset the changes (Firebug)
			Firebug.FireFile.resetStylesheet(href);
			
			// Reload Panel
			Firebug.currentContext.getPanel("firefile").select();
        }
    });

    function FireFilePanel() {}

    FireFilePanel.prototype = Obj.extend(Firebug.Panel,{

        template: domplate({
            changesList:
                DIV({"class": "cssFireFileSitesPanel",  role : 'presentation'},
                    DIV({role : 'list', 'aria-label' : "firefile" },
                        FOR("site", "$sites",
                            H1({style: "overflow: hidden;", class: "cssInheritHeader groupHeader focusRow FireFileSiteHook", role : 'listitem', siteurl: "$site.url"},
                                DIV({class: "cssFireFileHostLabel", style: "width: 2000px; float: left; display: inline;"},
                                    "$site.label",
                                    SPAN({class: "cssFireFileHostLabel"},
                                        A({href: "$site.url", target: "_blank"}, "$site.url|shortenUrl")
                                    )
                                ),
                                DIV({class: "cssFireFileSiteIconContainer"},
                                    SPAN({class: "cssFireFileSiteIcon cssFireFileHostDelete", title: Locale.$STR("TrashIconTooltip", "strings_firefile"), onclick: "$onDeleteClick"}),
                                    SPAN({class: "cssFireFileSiteIcon cssFireFileHostEdit", title: Locale.$STR("RenameIconTooltip", "strings_firefile"), onclick: "$onEditClick"}),
                                    SPAN({class: "cssFireFileSiteIcon cssFireFileHostAutoSave cssFireFileHostAutoSave$site.autosave|parseBool", title: Locale.$STR("AutoSaveIconTooltip", "strings_firefile"), onclick: "$onAutoSaveClick"})
                                )
                            ),
                            DIV({role : 'group'},
                                FOR("change", "$site.changes|orEmpty",
                                    TAG(FireFileChangesTags.styleSheetTag, {rule: "$change"})
                                )
                            )
                        )
                    )
                ),
            helpView:    
                DIV({"class": "cssFireFileSitesPanel",  role : 'presentation'},
                    DIV({role : 'list', 'aria-label' : "firefile" },
                        H1({class: "cssInheritHeader groupHeader focusRow", role : 'listitem'},
                            "$FireFileHelpTitle"
                        ),
                        H1({class: "cssInheritHeader groupHeader focusRow", role : 'listitem'},
                            "$DemoAccountTitle: ",
                            SPAN({class: "cssFireFileHostLabel"},
                                A({href: "$DemoAccountUrl", target: "_blank"}, "$DemoAccountUrl")
                            )
                        ),
                        DIV({class: "cssFireFileIntroduction"}, SPAN("$DemoAccountDescription")),
                        H1({class: "cssInheritHeader groupHeader focusRow", role : 'listitem'},
                            "$HelpTitle: ",
                            SPAN({class: "cssFireFileHostLabel"},
                                A({href: "$HelpUrl", target: "_blank"}, "$HelpUrl")
                            )
                        ),
                        DIV({class: "cssFireFileIntroduction"}, SPAN("$HelpDescription")),
                        H1({class: "cssInheritHeader groupHeader focusRow", role : 'listitem'},
                            "$UserGuideTitle: ",
                            SPAN({class: "cssFireFileHostLabel"},
                                A({href: "$UserGuideUrl", target: "_blank"}, "$UserGuideUrl")
                            )
                        ),
                        DIV({class: "cssFireFileIntroduction"}, SPAN("$UserGuideDescription"))
                    )
                ),                
            orEmpty: function(data) {
                if(!data) {
                    return [];
                }else{
                    return data;
                }
            },
            shortenUrl: function(data) {
                if(data.length > 80) {
                    return data.substr(0, 80) + "...";
                }else{
                    return data;
                }
            },
            parseBool: function(data) {
                if(data) {
                    return "On";
                }else{
                    return "Off";
                }
            },
            onEditClick: function(e) {
                
                var siteurl = Dom.getAncestorByClass(e.target, "FireFileSiteHook").getAttribute("siteurl");
                var siteindex = Firebug.FireFile.getSiteIndexByUrl(siteurl);
                var check = {value: false};
                var input = {value: Firebug.FireFile.sitesArray[siteindex].label};
                var result = PromptService.prompt(null, Firebug.FireFile.__("ChangeLabel"), Firebug.FireFile.__("EnterNewLabel"), input, null, check);

                if(result && input.value != "") {
                    if(!input.value.match(/[^a-zA-Z0-9-_\s\.\/]+/) && input.value.length <= 40) {
                        Firebug.FireFile.sitesArray[siteindex].label = input.value;
                        Firebug.FireFile.saveSitesArray();
                        Firebug.currentContext.getPanel("firefile").select();
                    }else{
                        Firebug.FireFile.updateNotify("fferror", 8, 1, "LabelError", true);
                    }
                }
                
            },
            onAutoSaveClick: function(e) {
                var siteurl = Dom.getAncestorByClass(e.target, "FireFileSiteHook").getAttribute("siteurl");
                var siteindex = Firebug.FireFile.getSiteIndexByUrl(siteurl);
                Firebug.FireFile.sitesArray[siteindex].autosave = !Firebug.FireFile.sitesArray[siteindex].autosave;
                Firebug.FireFile.saveSitesArray();
                Firebug.currentContext.getPanel("firefile").select();
            },
            onDeleteClick: function(e) {
                var siteurl = Dom.getAncestorByClass(e.target, "FireFileSiteHook").getAttribute("siteurl");
                var siteindex = Firebug.FireFile.getSiteIndexByUrl(siteurl);
                var result = PromptService.confirm(null, Firebug.FireFile.__("DeleteSite"), Firebug.FireFile.__("ReallyDeleteSite", Firebug.FireFile.sitesArray[siteindex].label));
                if(result === true) {
	
                    // DELETE SITE
                    Firebug.FireFile.sitesArray.splice(siteindex, 1);
                    Firebug.FireFile.saveSitesArray();
                    
                    // DELETE CHANGES
                    for(var i=Firebug.FireFile.modifiedStylesheets.length-1;i>=0;i--) {
                        if(Firebug.FireFile.getHrefInAllowedSites(Firebug.FireFile.modifiedStylesheets[i].href) === false) {
                            Firebug.FireFile.modifiedStylesheets.splice(i, 1);
                        }
                    }
                    
                    Firebug.currentContext.getPanel("firefile").select();
                }
            }
        }),
        
        select: function() {
            
            // LOAD FULL SITES ARRAY AGAIN
            var sites = Firebug.FireFile.getSitesArray();
            var changes = Firebug.FireFile.modifiedStylesheets;
            
            if(sites.length > 0) {
                
                // PREPARE CHANGES IN SITES ARRAY
                for(var i=0;i<sites.length;i++){
                    sites[i].changes = [];
                    sites[i].changeCount = 0;
                }
                
                // BUILD SITES / CHANGES ARRAY
                for(var i=0;i<changes.length;i++) {
                    var related_site = Firebug.FireFile.getHrefInAllowedSites(changes[i].href);
                    if(related_site) {
                        var host = Firebug.FireFile.getHostFromHref(related_site.url);

                        // ADD CHANGES TO STYLE
                        related_site.changes.push(changes[i]);
                        related_site.changeCount++;
                    }
                }
                var result = this.template.changesList.replace({sites: sites}, this.panelNode);
            }else{
                var translation = {
                    FireFileHelpTitle: Firebug.FireFile.__("FireFileHelpTitle"),
                    DemoAccountDescription: Firebug.FireFile.__("DemoAccountDescription"),
                    DemoAccountTitle: Firebug.FireFile.__("DemoAccountTitle"),
                    DemoAccountUrl: Firebug.FireFile.__("DemoAccountUrl"),
                    HelpDescription: Firebug.FireFile.__("HelpDescription"),
                    HelpTitle: Firebug.FireFile.__("HelpTitle"),
                    HelpUrl: Firebug.FireFile.__("HelpUrl"),
                    UserGuideDescription: Firebug.FireFile.__("UserGuideDescription"),
                    UserGuideTitle: Firebug.FireFile.__("UserGuideTitle"),
                    UserGuideUrl: Firebug.FireFile.__("UserGuideUrl")
                };
                var result = this.template.helpView.replace(translation, this.panelNode);
            }
        },

        name: "firefile",
        title: Firebug.FireFile.__("FireFile"),
        parentPanel: "html",
        order: 1,

        initialize: function() {
            Firebug.CSSStyleSheetPanel.prototype.initialize.apply(this, arguments);
        },

        show: function(state) {
            
        },

        supportsObject: function(object) {
            return object instanceof Element ? 1 : 0;
        },

        updateOption: function(name, value) {
            if (name == "existing_site") {
                this.refresh();
            }
        },

        getOptionsMenuItems: function() {
			
			// Actions
            var ret = [
                {label: Firebug.FireFile.__("save_all_changes"), tooltiptext: Locale.$STR("SaveAllChangesTooltip", "strings_firefile"), command: function() { Firebug.FireFile.saveAllChanges(); } },
				{label: Firebug.FireFile.__("cancel_all_changes"), tooltiptext: Locale.$STR("CancelAllChangesTooltip", "strings_firefile"), command: function() { Firebug.FireFile.cancelAllChanges(); } }
            ];

			// Toggles
			for(var pref in Firebug.FireFile.prefs) {
				ret.push({
					label: Firebug.FireFile.__(pref),
					tooltiptext: Locale.$STR(pref + "_tooltip", "strings_firefile"),
					type: "checkbox",
					checked: Firebug.FireFile.prefs[pref],
		            command: Obj.bindFixed(Firebug.FireFile.togglePref, Firebug.FireFile, pref)
				});
			}

            return ret;
        },

	    getDecorator: function(sourceBox) {
	        return Firebug.ScriptPanel.decorator;
	    }

    });
    
    Firebug.Console.log("FireFilePanel");
    Firebug.Console.log(FireFilePanel);
    
        
    return FireFilePanel;
    
}})