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
                    SPAN({class: "$rule|isTouched", onclick: "$saveChange", title: $STR("ClickToSaveChanges", "strings_firefile")}),
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
        }
    });

    function FireFilePanel() {}

    FireFilePanel.prototype = extend(Firebug.Panel,{

        template: domplate({
            changesList:
                DIV({"class": "cssFireFileSitesPanel",  role : 'presentation'},
                    DIV({role : 'list', 'aria-label' : "firefile" },
                        FOR("site", "$sites",
                            H1({style: "overflow: hidden;", class: "cssInheritHeader groupHeader focusRow FireFileSiteHook", role : 'listitem', siteid: "$site.id", siteurl: "$site.url"},
                                DIV({class: "cssFireFileHostLabel", style: "width: 2000px; float: left; display: inline;"},
                                    "$site.label",
                                    SPAN({class: "cssFireFileHostLabel"},
                                        A({href: "$site.url", target: "_blank"}, "$site.url|shortenUrl")
                                    )
                                ),
                                DIV({class: "cssFireFileSiteIconContainer"},
                                    SPAN({class: "cssFireFileSiteIcon cssFireFileHostDelete", title: $STR("TrashIconTooltip", "strings_firefile"), onclick: "$onDeleteClick"}),
                                    SPAN({class: "cssFireFileSiteIcon cssFireFileHostEdit", title: $STR("RenameIconTooltip", "strings_firefile"), onclick: "$onEditClick"}),
                                    SPAN({class: "cssFireFileSiteIcon cssFireFileHostAutoSave cssFireFileHostAutoSave$site.autosave|parseBool", title: $STR("AutoSaveIconTooltip", "strings_firefile"), onclick: "$onAutoSaveClick"})
                                )
                            ),
                            DIV({role : 'group'},
                                FOR("change", "$site|getChanges",
                                    TAG(FireFileChangesTags.styleSheetTag, {rule: "$change"})
                                )
                            )
                        ),
                        H1({style: "overflow: hidden;", class: "cssInheritHeader groupHeader focusRow", role : 'listitem'},
                            DIV({class: "cssFireFileHostLabel", style: "width: 2000px; float: left; display: inline;"},
	                            SPAN({class: "cssFireFileSiteIcon fireFileAddSiteIcon", title: $STR("AddSiteIconTooltip", "strings_firefile"), onclick: "$onAddSiteClick"}, "Add new Site (FTP)")
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
			getChanges: function(site) {
												
				return Firebug.FireFile.getStylesheetsBySite(site);
			},
            onEditClick: function(e) {
	
				// FireForms Edit function
				// Get current site
				var id = getAncestorByClass(e.target, "FireFileSiteHook").getAttribute("siteid");
				var site = Firebug.FireFile.db.grab(id, "sites");

				// Open Edit dialog
				var editForm = new Firebug.FireFile.FireForms("sites", {
					validation: {
						host: {
							regexp: '(ftp|http|https):\/\/[a-zA-Z0-9.-_+/?&;]+',
							error: 'Please enter a valid host name (incl. http)'
						},
						label: {
							regexp: '^[a-zA-Z0-9-_\s]+$',
							error: 'Please enter a valid site label'
						}
					}
				});
				var updated_site = editForm.editDialog(site);

				// Save if valid
				if(updated_site) {
					Firebug.FireFile.db.update(updated_site, "sites");
				}
				
				// Refresh List
			    FirebugContext.getPanel("firefile").select();
	
	
                /*
                var siteurl = getAncestorByClass(e.target, "FireFileSiteHook").getAttribute("siteurl");
                var siteindex = Firebug.FireFile.getSiteIndexByUrl(siteurl);
                var check = {value: false};
                var input = {value: Firebug.FireFile.sitesArray[siteindex].label};
                var result = PromptService.prompt(null, Firebug.FireFile.__("ChangeLabel"), Firebug.FireFile.__("EnterNewLabel"), input, null, check);

                if(result && input.value != "") {
                    if(!input.value.match(/[^a-zA-Z0-9-_\s\.\/]+/) && input.value.length <= 40) {
                        Firebug.FireFile.sitesArray[siteindex].label = input.value;
                        Firebug.FireFile.saveSitesArray();
                        FirebugContext.getPanel("firefile").select();
                    }else{
                        Firebug.FireFile.updateNotify("fferror", 8, 1, "LabelError", true);
                    }
                }
*/
                
            },
            onAddSiteClick: function(e) {
	
				// Get current site
				var id = getAncestorByClass(e.target, "FireFileSiteHook").getAttribute("siteid");
				var site = Firebug.FireFile.db.grab(id, "sites");

				// Open Edit dialog
				var editForm = new Firebug.FireFile.FireForms("sites");
				editForm.editDialog();

				// Refresh List
                FirebugContext.getPanel("firefile").select();

                /*
                var siteurl = getAncestorByClass(e.target, "FireFileSiteHook").getAttribute("siteurl");
                var siteindex = Firebug.FireFile.getSiteIndexByUrl(siteurl);
                var check = {value: false};
                var input = {value: Firebug.FireFile.sitesArray[siteindex].label};
                var result = PromptService.prompt(null, Firebug.FireFile.__("ChangeLabel"), Firebug.FireFile.__("EnterNewLabel"), input, null, check);

                if(result && input.value != "") {
                    if(!input.value.match(/[^a-zA-Z0-9-_\s\.\/]+/) && input.value.length <= 40) {
                        Firebug.FireFile.sitesArray[siteindex].label = input.value;
                        Firebug.FireFile.saveSitesArray();
                        FirebugContext.getPanel("firefile").select();
                    }else{
                        Firebug.FireFile.updateNotify("fferror", 8, 1, "LabelError", true);
                    }
                }*/
                
            },
            onAutoSaveClick: function(e) {
				var id = getAncestorByClass(e.target, "FireFileSiteHook").getAttribute("siteid");
				Firebug.FireFile.db.toggle(id, "autosave", "sites");
                FirebugContext.getPanel("firefile").select();
            },
            onDeleteClick: function(e) {
                var siteurl = getAncestorByClass(e.target, "FireFileSiteHook").getAttribute("siteurl");
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
                    
                    FirebugContext.getPanel("firefile").select();
                }
            }
        }),
        
        select: function() {
            
			try {
            
			// LOAD FULL SITES ARRAY AGAIN
            var sites = Firebug.FireFile.getSitesArray();
            var changes = Firebug.FireFile.modifiedStylesheets;
            

            if(sites.length > 0) {
				// Output changes list
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

			}catch(err) {
				alert(err);
				Firebug.Console.log(err);
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
                {label: Firebug.FireFile.__("save_all_changes"), tooltiptext: $STR("SaveAllChangesTooltip", "strings_firefile"), command: function() { Firebug.FireFile.saveAllChanges(); } }
            ];

			// Toggles
			for(var pref in Firebug.FireFile.prefs) {
				ret.push({
					label: Firebug.FireFile.__(pref),
					tooltiptext: $STR(pref + "_tooltip", "strings_firefile"),
					type: "checkbox",
					checked: Firebug.FireFile.prefs[pref],
		            command: bindFixed(Firebug.FireFile.togglePref, Firebug.FireFile, pref)
				});
			}

            return ret;
        },

	    getDecorator: function(sourceBox) {
	        return Firebug.ScriptPanel.decorator;
	    }

    });
    
	try{
    	Firebug.registerPanel(FireFilePanel);
	}catch(err){
		alert("err");
		Firebug.Console.log(err);
	} 
    
}});