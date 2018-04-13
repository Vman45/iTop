//iTop Search form handler
;
$(function()
{
	// the widget definition, where 'itop' is the namespace,
	// 'search_form_handler' the widget name
	$.widget( 'itop.search_form_handler',
	{
		// default options
		options:
		{
			'criterion_outer_selector': null,
			'result_list_outer_selector': null,
			'data_config_list_selector': null,
			'endpoint': null,
			'init_opened': false,
			'auto_submit': true,
			'search': {
				'base_oql': '',
				'class_name': null,
				'criterion': [
					// Structure
					// {
					// 	'or': [
					// 		{
					// 			'and': [
					// 				{
					// 					'ref': 'alias.code',
					// 					'operator': 'contains',
					// 					'values': [
					// 						{
					// 							'value': 'foo',
					// 							'label': 'bar',
					// 						}
					// 					],
					// 					'is_removable': true,
					// 					'oql': '',
					// 				},
					// 			]
					// 		},
					// 	]
					// },
				],
				'fields': [
					// Structure
					// 'zlist': {
					// 	'alias.code': {
					// 		'class_alias': '',
					// 			'class': '',
					// 			'code': '',
					// 			'label': '',
					// 			'type': '',
					// 			'allowed_values': {...},
					// 	},
					// },
					// 'others': {
					// 	'alias.code': {
					// 		'class_alias': '',
					// 			'class': '',
					// 			'code': '',
					// 			'label': '',
					// 			'type': '',
					// 			'allowed_values': {...},
					// 	},
					// },
				],
			},
			'default_criteria_type': 'raw',
			'conf_parameters': {
				'min_autocomplete_chars': 3,
				'datepicker': {
					'dayNamesMin': ['Su','Mo','Tu','We','Th','Fr','Sa'],
					'monthNamesShort': ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
					'firstDay': 0,
				},
			},
		},

		// jQuery elements
		elements: null,

		// Submit properties (XHR, throttle, ...)
		submit: null,

		// the constructor
		_create: function()
		{
			var me = this;
			
			this.element.addClass('search_form_handler');

			// Init properties (complexe type properties would be static if not initialized with a simple type variable...)
			this.elements = {
				message_area: null,
				criterion_area: null,
				more_criterion: null,
				submit_button: null,
				results_area: null,
			};
			this.submit = {
				xhr: null,
			};

			//init others widgets :
			this.element.search_form_handler_history({'itop_root_class':me.options.search.class_name});

			// Prepare DOM elements
			this._prepareFormArea();
			this._prepareCriterionArea();
			this._prepareResultsArea();

			// Binding events (eg. from search_form_criteria widgets)
			this._bindEvents();
		},
		// called when created, and later when changing options
		_refresh: function()
		{
			
		},
		// events bound via _bind are removed automatically
		// revert other modifications here
		_destroy: function()
		{
			this.element
			.removeClass('search_form_handler');
		},
		// _setOptions is called with a hash of all options that are changing
		// always refresh when changing options
		_setOptions: function()
		{
			this._superApply(arguments);
		},
		// _setOption is called for each individual option that is changing
		_setOption: function( key, value )
		{
			this._super( key, value );
		},


		//
		_bindEvents: function()
		{
			var me = this;

			// Form events
			// - Prevent regular form submission (eg. hitting "Enter" in inputs)
			this.element.on('submit', function(oEvent){
				oEvent.preventDefault();
			});
			// - Submit the search form
			this.element.on('itop.search.form.submit', function(oEvent, oData){
				me._onSubmit();
			});
			// - Search form has been reloaded by the page
			this.element.on('itop.search.form.reloaded', function(){
				if(me.options.auto_submit === true)
				{
					me._submit();
				}
			});

			// Criteria events
			this.element.on('itop.search.criteria.value_changed', function(oEvent, oData){
				me._onCriteriaValueChanged(oData);
			});
			this.element.on('itop.search.criteria.removed', function(oEvent, oData){
				me._onCriteriaRemoved(oData);
			});
			this.element.on('itop.search.criteria.error_occured', function(oEvent, oData){
				me._onCriteriaErrorOccured(oData);
			});

			$('body').on('update_history.itop', function(oEvent, oData) {

				// if (me.element.parents('.ui-dialog').length != 0)
				// {
				// 	//search form in modal are forbidden to update history!
				// 	return;
				// }

                if ($('.ui-dialog:visible :itop-search_form_handler').length != 0)
                {
                    //if a modal containing a search form is visible then the history update event come from it, whe do not want to update the history in this case! because search form in modal are forbidden to update history!
                    return;
                }

				var sNewUrl = GetAbsoluteUrlAppRoot()+'pages/UI.php?operation=search';
				sNewUrl = sNewUrl + '&filter='+oData['filter'];
				sNewUrl = sNewUrl + '&c[menu]='+me._extractURLParameter(window.location.href, "c[menu]");
				if ('' != me._extractURLParameter(window.location.href, "debug"))
				{
					sNewUrl = sNewUrl + '&debug='+me._extractURLParameter(window.location.href, "debug");
				}

				history.replaceState(null, null, sNewUrl);

				$('#itop-breadcrumb')
					.breadcrumb('destroy')
					.breadcrumb({
					itop_instance_id: oData['breadcrumb_instance_id'],
					max_count: oData['breadcrumb_max_count'],
					new_entry: {
						"id": oData['breadcrumb_id'],
						"label": oData['breadcrumb_label'],
						"url": sNewUrl,
						'icon': oData['breadcrumb_icon'],
						'description': ''
					}
				});
			});

		},
		// - Update search option of the widget
		_updateSearch: function()
		{
			var me = this;

			// Criterion
			var oCriterion = {
				'or': [{
					'and': []
				}]
			};
			// - Retrieve criterion
			this.elements.criterion_area.find('.sf_criterion_row').each(function(iIdx){
				var oCriterionRowElem = $(this);

				oCriterion['or'][iIdx] = {'and': []};
				oCriterionRowElem.find('.search_form_criteria').each(function(){
					var oCriteriaData = $(this).triggerHandler('itop.search.criteria.get_data');
					oCriterion['or'][iIdx]['and'].push(oCriteriaData);
				});
			});
			// - Update search
			this.options.search.criterion = oCriterion;

			// No need to update base OQL and fields
		},
		// - Open / Close more criterion menu
		_openMoreCriterion: function()
		{
			// Open more criterion menu
			// - Open it first
			this.elements.more_criterion.addClass('opened');
			// - Focus filter
			this.elements.more_criterion.find('.sf_filter:first input[type="text"]')
				.val('')
				.focus();
			// - Then only check if more menu is to close to the right side (otherwise we might not have the right element's position)
			var iFormWidth = this.element.outerWidth();
			var iFormLeftPos = this.element.offset().left;
			var iMenuWidth = this.elements.more_criterion.find('.sfm_content').outerWidth();
			var iMenuLeftPos = this.elements.more_criterion.find('.sfm_content').offset().left;
			if( (iMenuWidth + iMenuLeftPos) > (iFormWidth + iFormLeftPos - 10 /* Security margin */) )
			{
				this.elements.more_criterion.addClass('opened_left');
			}
		},
		_closeMoreCriterion: function()
		{
			this.elements.more_criterion.removeClass('opened_left');
			this.elements.more_criterion.removeClass('opened');
		},
		_toggleMoreCriterion: function()
		{
			// Calling methods instead of toggling the class so additional processing are done.
			if(this.elements.more_criterion.hasClass('opened'))
			{
				this._closeMoreCriterion();
			}
			else
			{
				this._openMoreCriterion();
			}
		},
		// - Close all criterion
		_closeAllCriterion: function()
		{
			this.elements.criterion_area.find('.search_form_criteria.opened').each(function(){
				$(this).triggerHandler('itop.search.criteria.close');
			});
		},

		// DOM helpers
		// - Prepare form area
		_prepareFormArea: function()
		{
			var me = this;

			// Build DOM elements
			// - Autosubmit option
			if(this.options.auto_submit === false)
			{
				this.element.addClass('no_auto_submit');
			}
			// - Message area
			this.elements.message_area = this.element.find('.sf_message');
			this._cleanMessageArea();

			// Events
			// - Refresh icon
			this.element.find('.sft_refresh').on('click', function(oEvent){
				// Prevent anchor
				oEvent.preventDefault();
				// Prevent form toggling
				oEvent.stopPropagation();

				me._submit();
			});
			// - Toggle icon
			this.element.find('.sf_title').on('click', function(oEvent){
				// Prevent anchors
				oEvent.preventDefault();

				// Prevent toggle on <select>
				if(oEvent.target.nodeName.toLowerCase() !== 'select')
				{
					me.element.toggleClass('closed');
				}
			});
		},
		// - Prepare criterion area
		_prepareCriterionArea: function()
		{
			var oCriterionAreaElem;

			// Build area element
			if(this.options.criterion_outer_selector !== null && $(this.options.criterion_outer_selector).length > 0)
			{
				oCriterionAreaElem = $(this.options.criterion_outer_selector);
			}
			else
			{
				oCriterionAreaElem = $('<div></div>').appendTo(this.element);
			}
			oCriterionAreaElem.addClass('sf_criterion_area');
			this.elements.criterion_area = oCriterionAreaElem;

			// Clean area
			oCriterionAreaElem
				.html('')
				.append('<div class="sf_criterion_row"></div>');

			// Prepare content
			this._prepareMoreCriterionMenu();
			this._prepareExistingCriterion();
			this._prepareSubmitButton();
		},
		// - Prepare "more" button
		_prepareMoreCriterionMenu: function()
		{
			var me = this;

			// DOM
			this.elements.more_criterion = $('<div></div>')
				.addClass('sf_more_criterion')
				.appendTo(this.elements.criterion_area.find('.sf_criterion_row:first'));

			// Header part
			var oHeaderElem = $('<div class="sfm_header"></div>')
				.append('<a class="sfm_toggler" href="#"><span class="sfm_tg_title">' + Dict.S('UI:Search:Criterion:MoreMenu:AddCriteria') + '</span><span class="sfm_tg_icon fa fa-plus"></span></a>')
				.appendTo(this.elements.more_criterion);

			// Content part
			var oContentElem = $('<div class="sfm_content"></div>')
				.appendTo(this.elements.more_criterion);

			// - Filter
			var oFilterElem = $('<div></div>')
				.addClass('sf_filter')
				.addClass('sfm_filter')
				.append('<span class="sff_input_wrapper"><input type="text" placeholder="' + Dict.S('UI:Search:Value:Filter:Placeholder') + '" /><span class="sff_picto sff_filter fa fa-filter"></span><span class="sff_picto sff_reset fa fa-times"></span></span>')
				.appendTo(oContentElem);

			// - Lists container
			var oListsElem = $('<div></div>')
				.addClass('sfm_lists')
				.appendTo(oContentElem);

			// - Recently used list
			var oRecentsElem = $('<div></div>')
				.addClass('sf_list')
				.addClass('sf_list_recents')
				.appendTo(oListsElem);

			$('<div class="sfl_title"></div>')
				.text(Dict.S('UI:Search:AddCriteria:List:RecentlyUsed:Title'))
				.appendTo(oRecentsElem);

			var oRecentsItemsElem = $('<ul class="sfl_items"></ul>')
				.append('<li class="sfl_i_placeholder">' + Dict.S('UI:Search:AddCriteria:List:RecentlyUsed:Placeholder') + '</li>')
				.appendTo(oRecentsElem);

			me._refreshRecentlyUsed();

			// - Search zlist list
			var oZlistElem = $('<div></div>')
				.addClass('sf_list')
				.addClass('sf_list_zlist')
				.appendTo(oListsElem);

			$('<div class="sfl_title"></div>')
				.text(Dict.S('UI:Search:AddCriteria:List:MostPopular:Title'))
				.appendTo(oZlistElem);

			var oZListItemsElem = $('<ul class="sfl_items"></ul>')
				.appendTo(oZlistElem);

			for(var sFieldRef in this.options.search.fields.zlist)
			{
				var oFieldElem = me._getHtmlLiFromFieldRef(me, sFieldRef, ['zlist']);
				oFieldElem.appendTo(oZListItemsElem);
			}

			// - Remaining fields list
			if(this.options.search.fields.others !== undefined)
			{
				var oOthersElem = $('<div></div>')
					.addClass('sf_list')
					.addClass('sf_list_others')
					.appendTo(oListsElem);

				$('<div class="sfl_title"></div>')
					.text(Dict.S('UI:Search:AddCriteria:List:Others:Title'))
					.appendTo(oOthersElem);

				var oOthersItemsElem = $('<ul class="sfl_items"></ul>')
					.appendTo(oOthersElem);

				for(var sFieldRef in this.options.search.fields.others)
				{
					var oFieldElem = me._getHtmlLiFromFieldRef(me, sFieldRef, ['others']);
					oFieldElem.appendTo(oOthersItemsElem);
				}
			}

			// - Buttons
			var oButtonsElem = $('<div></div>')
				.addClass('sfm_buttons')
				.append('<button type="button" name="apply">' + Dict.S('UI:Button:Apply') + '</button>')
				.append('<button type="button" name="cancel">' + Dict.S('UI:Button:Cancel') + '</button>')
				.appendTo(oContentElem);

			// Bind events
			// - Close menu on click anywhere else
			// - Intercept click to avoid propagation (mostly used for closing it when clicking outside of it)
			$('body').on('click', function(oEvent){
				// Prevent propagation to parents and therefore multiple attempts to close it
				oEvent.stopPropagation();

				oEventTargetElem = $(oEvent.target);

				// If not more menu, close all criterion
				if(oEventTargetElem.closest('.sf_more_criterion').length > 0)
				{
					me._closeAllCriterion();
				}
				else
				{
					// TODO: Try to put this back in the date widget as it introduced a non necessary coupling.
					// If using the datetimepicker, do not close anything
					if (oEventTargetElem.closest('#ui-datepicker-div, .ui-datepicker-prev, .ui-datepicker-next').length > 0 )
					{
						// No closing in this case
					}
					// //if the context is not document, then we  have encountered a bug : the css ::after elements do have a context on click and thus, we cannot check if they are inside a  #ui-datepicker-div
					// else if (typeof oEventTargetElem.context != 'undefined' && $(oEventTargetElem.context).is('.ui-icon'))
					// {
					// 	//no closing in this case (bugfix)
					// }
					// If criteria, close more menu & all criterion but me
					else if(oEventTargetElem.closest('.search_form_criteria').length > 0)
					{
						me._closeMoreCriterion();
						// All criterion but me is already handle by the criterion, no callback needed.
					}
					// If not criteria, close more menu & all criterion
					else
					{
						me._closeMoreCriterion();
						me._closeAllCriterion();
					}
				}
			});

			// - More criteria toggling
			this.elements.more_criterion.find('.sfm_header').on('click', function(oEvent){
				// Prevent anchor
				oEvent.preventDefault();

				me._toggleMoreCriterion();
			});

			// - Filter
			// Note: "keyup" event is use instead of "keydown", otherwise, the inpu value would not be set yet.
			oFilterElem.find('input').on('keyup focus', function(oEvent){
				// TODO: Move on values with up and down arrow keys; select with space or enter.
				// TODO: Hide list if no result on filter.

				var sFilter = $(this).val();

				// Show / hide items
				if(sFilter === '')
				{
					oListsElem.find('.sfl_items > li').show();
					oFilterElem.find('.sff_filter').show();
					oFilterElem.find('.sff_reset').hide();
				}
				else
				{
					oListsElem.find('.sfl_items > li:not(.sfl_i_placeholder)').each(function(){
						var oRegExp = new RegExp(sFilter.latinize(), 'ig');
						var sValue = $(this).find('input').val();
						var sLabel = $(this).text();

						// We don't check the sValue as it contains the class alias.
						if(sLabel.latinise().match(oRegExp) !== null)
						{
							$(this).show();
						}
						else
						{
							$(this).hide();
						}
					});
					oFilterElem.find('.sff_filter').hide();
					oFilterElem.find('.sff_reset').show();
				}

				// Show / hide lists with no visible items
				oListsElem.find('.sf_list').each(function(){
					$(this).show();
					if($(this).find('.sfl_items > li:visible').length === 0)
					{
						$(this).hide();
					}
				});
			});
			oFilterElem.find('.sff_filter').on('click', function(){
				oFilterElem.find('input').trigger('focus');
			});
			oFilterElem.find('.sff_reset').on('click', function(){
				oFilterElem.find('input')
					.val('')
					.trigger('focus');
			});

			// - Add one criteria
			this.elements.more_criterion.on('click', '.sfm_field', function(oEvent){
				// Prevent anchor
				oEvent.preventDefault();
				// Prevent propagation to not close the opening criteria
				oEvent.stopPropagation();

				// If no checkbox checked, add criteria right away, otherwise we "queue" it we other checkboxed.
				if(me.elements.more_criterion.find('.sfm_field input[type="checkbox"]:checked').length === 0)
				{
					var sFieldRef = $(this).attr('data-field-ref');

					// Prepare new criterion data (as already opened to increase UX)
					var oData = {
						'ref': sFieldRef,
						'init_opened': (oEvent.ctrlKey) ? false : true,
					};

					// Add criteria but don't submit form as the user has not specified the value yet.
					me.element.search_form_handler_history('setLatest', sFieldRef);
					me._refreshRecentlyUsed();
					me._addCriteria(oData);
				}
				else
				{
					$(this).find('input[type="checkbox"]').prop('checked', !$(this).find('input[type="checkbox"]').prop('checked'));
				}
			});

			// - Add several criterion
			this.elements.more_criterion.on('click', '.sfm_field input[type="checkbox"]', function(oEvent){
				// Prevent propagation to field and instant add of the criteria
				oEvent.stopPropagation();

				if(me.elements.more_criterion.find('.sfm_field input[type="checkbox"]:checked').length === 0)
				{
					oButtonsElem.hide();
				}
				else
				{
					oButtonsElem.show();
				}

				// Put focus back to filter to improve UX.
				oFilterElem.find('input').trigger('focus');
			});
			oButtonsElem.find('button').on('click', function(){
				// Add criterion on apply
				if($(this).attr('name') === 'apply')
				{
					me.elements.more_criterion.find('.sfm_field input[type="checkbox"]:checked').each(function(iIdx, oElem){
						var sFieldRef = $(oElem).closest('.sfm_field').attr('data-field-ref');
						var oData = {
							'ref': sFieldRef,
							'init_opened': false,
						};

						me.element.search_form_handler_history('setLatest', sFieldRef);
						me._addCriteria(oData);
					});

					me._refreshRecentlyUsed();
					me._closeMoreCriterion();
				}

				// Clear all
				// - Checkboxes
				me.elements.more_criterion.find('.sfm_field input[type="checkbox"]:checked').prop('checked', false);
				// - Filter
				oFilterElem.find('input')
					.val('')
					.trigger('focus');

				// Hide buttons
				oButtonsElem.hide();
			});
		},
		// - Prepare "submit" button
		_prepareSubmitButton: function()
		{
			var me = this;

			// DOM
			this.elements.submit_button = $('<div></div>')
				.addClass('sf_button')
				.addClass('sf_submit')
				.appendTo(this.elements.criterion_area.find('.sf_criterion_row:first'));

			var sButtonText = (this.options.auto_submit === true) ? Dict.S('UI:Button:Refresh') : Dict.S('UI:Button:Search');
			var oButtonElem = $('<div class="sfb_header"></div>')
				.append('<a class="fa fa-fw fa-search" title="' + sButtonText + '" href="#"></a>')
				.appendTo(this.elements.submit_button);

			// Bind events
			// - Add one criteria
			this.elements.submit_button.on('click', function(oEvent){
				// Prevent anchor
				oEvent.preventDefault();

				me._onSubmitClick();
			});
		},
		// - Prepare existing criterion
		_prepareExistingCriterion: function()
		{
			// - OR conditions
			var iORCount = 0;
			var aORs = (this.options.search.criterion['or'] !== undefined) ? this.options.search.criterion['or'] : [];
			for(var iORIdx in aORs)
			{
				if(this.elements.criterion_area.find('.sf_criterion_row:nth-of-type(' + (iORCount+1) + ')').length > 0)
				{
					var oCriterionRowElem = this.elements.criterion_area.find('.sf_criterion_row:nth-of-type(' + (iORCount+1) + ')');
				}
				else
				{
					var oCriterionRowElem = $('<div></div>')
						.addClass('sf_criterion_row')
						.appendTo(this.elements.criterion_area);
				}

				if(oCriterionRowElem.find('.sf_criterion_group').length > 0)
				{
					var oCriterionGroupElem = oCriterionRowElem.find('.sf_criterion_group');
				}
				else
				{
					var oCriterionGroupElem = $('<div></div>')
						.addClass('sf_criterion_group')
						.appendTo(oCriterionRowElem);
				}

				var aANDs = (aORs[iORIdx]['and'] !== undefined) ? aORs[iORIdx]['and'] : [];
				for(var iANDIdx in aANDs)
				{
					var oCriteriaData = aANDs[iANDIdx];
					this._addCriteria(oCriteriaData, oCriterionGroupElem);
				}

				iORCount++;
			}
		},
		// - Prepare results area
		_prepareResultsArea: function()
		{
			var me = this;

			var oResultAreaElem;

			// Build area element
			if(this.options.result_list_outer_selector !== null && $(this.options.result_list_outer_selector).length > 0)
			{
				oResultAreaElem = $(this.options.result_list_outer_selector);
			}
			else
			{
				// Reusing previously created DOM element
				if(this.element.closest('.display_block').next('.sf_results_area').length > 0)
				{
					oResultAreaElem = this.element.closest('.display_block').next('.sf_results_area');
				}
				else
				{
					oResultAreaElem = $('<div class="display_block"></div>').insertAfter(this.element.closest('.display_block'));
				}
			}
			oResultAreaElem.addClass('sf_results_area');

			// Make placeholder if nothing yet
			if(oResultAreaElem.html() === '')
			{
				// TODO: Make a good UI for this POC.
				// TODO: Translate sentence.
				oResultAreaElem.html('<div class="sf_results_placeholder"><p>Add some criterion on the search box or click the search button to view the objects.</p><p><button type="button">Search<span class="fa fa-search"></span></button></p></div>');
				oResultAreaElem.find('button').on('click', function(){
					// TODO: Bug: Open "Search for CI", change child classe in the dropdown, click the search button. It submit the search for the original child classe, not the current one; whereas a click on the upper right pictogram does. This might be due to the form reloading.
					me._onSubmitClick();
				});

				if (me.element.find('.search_form_criteria').length == 0)
				{
					me.elements.more_criterion.find('.sfm_header').trigger('click');
				}
			}

			this.elements.results_area = oResultAreaElem;
		},

		/**
		 *  "add new criteria" <li /> markup
		 *   - with checkbox, label, data-* ...
		 *   - without event binding
		 *
		 * @private
		 *
		 * @param sFieldRef
		 * @param aFieldCollectionsEligible
		 *
		 * @return jQuery detached <li />
		 */
		_getHtmlLiFromFieldRef: function(me, sFieldRef, aFieldCollectionsEligible) {
			var oFieldElem = undefined;

			aFieldCollectionsEligible.forEach(function (sFieldCollection) {
				if (typeof me.options.search.fields[sFieldCollection][sFieldRef] == 'undefined')
				{
					return true;//if this field is not present in the Collection, let's try the next
				}

				var oField = me.options.search.fields[sFieldCollection][sFieldRef];
				var sFieldTitleAttr = (oField.description !== undefined) ? 'title="' + oField.description + '"' : '';
				oFieldElem = $('<li></li>')
					.addClass('sfm_field')
					.attr('data-field-ref', sFieldRef)
					.append('<label ' + sFieldTitleAttr + '><input type="checkbox" value="' + sFieldRef + '" />' + oField.label + '</label>')
			});

			if (undefined == oFieldElem)
			{
				me._trace('no sFieldRef in given collection', {"sFieldRef":sFieldRef, "aFieldCollectionsEligible":aFieldCollectionsEligible});
				return $('<!-- no sFieldRef in given collection -->');
			}

			return oFieldElem;
		},


		// Criteria helpers
		// - Add a criteria to the form
		_addCriteria: function(oData, oCriterionGroupElem)
		{
			var sRef = oData.ref;
			var sType = sType = (oData.widget !== undefined) ? oData.widget : this._getCriteriaTypeFromFieldRef(sRef);

			// Force to raw for non removable criteria
			if( (oData.is_removable !== undefined) && (oData.is_removable === false) )
			{
				sType = 'raw';
			}

			// Add to first OR condition if not specified
			if(oCriterionGroupElem === undefined)
			{
				oCriterionGroupElem = this.elements.criterion_area.find('.sf_criterion_row:first .sf_criterion_group');
			}

			// Protection against bad initialization data
			if(sType === null)
			{
				this._trace('Could not add criteria as we could not retrieve type for ref "'+sRef+'".');
				return false;
			}

			// Retrieve widget class
			var sWidgetName = this._getCriteriaWidgetNameFromType(sType);

			// Add some informations from the field
			if(this._hasFieldDefinition(sRef))
			{
				var oFieldDef = this._getFieldDefinition(sRef);
				oData.field = {
					label: oFieldDef.label,
					class: oFieldDef.class,
					class_alias: oFieldDef.class_alias,
                    code: oFieldDef.code,
                    has_index: oFieldDef.has_index,
					target_class: oFieldDef.target_class,
					widget: oFieldDef.widget,
					allowed_values: oFieldDef.allowed_values,
					is_null_allowed: oFieldDef.is_null_allowed,
				};
			}

			// Add widget specific data
			if( (sType === 'date') || (sType === 'date_time') )
			{
				oData.datepicker = this.options.conf_parameters.datepicker;
			}
			if( (sType === 'enum') || (sType === 'external_key') )
			{
				oData.autocomplete = {
					'min_autocomplete_chars': this.options.conf_parameters.min_autocomplete_chars,
				};
			}

			// Create DOM element
			var oCriteriaElem = $('<div></div>')
				.addClass('sf_criteria')
				.appendTo(oCriterionGroupElem);

			// Instanciate widget
			$.itop[sWidgetName](oData, oCriteriaElem);

			return true;
		},
		// - Find a criteria's type from a field's ref (usually <CLASS_ALIAS>.<ATT_CODE>)
		_getCriteriaTypeFromFieldRef: function(sRef)
		{
			// Fallback for unknown widget types or unknown field refs
			var sType = this.options.default_criteria_type;

			for(var sListIdx in this.options.search.fields)
			{
				if(this.options.search.fields[sListIdx][sRef] !== undefined)
				{
					sType = this.options.search.fields[sListIdx][sRef].widget.toLowerCase();
					break;
				}
			}

			return sType;
		},
		// - Find a criteria's widget name from a criteria's type
		_getCriteriaWidgetNameFromType: function(sType)
		{
			return 'search_form_criteria' + '_' + (($.itop['search_form_criteria_'+sType] !== undefined) ? sType : 'raw');
		},
		// Criteria handlers
		_onCriteriaValueChanged: function(oData)
		{
			this._updateSearch();
			if(this.options.auto_submit === true)
			{
				this._submit();
			}
		},
		_onCriteriaRemoved: function(oData)
		{
			this._updateSearch();
			this._submit();
		},
		_onCriteriaErrorOccured: function(oData)
		{
			this._setErrorMessage(oData);
		},

		// Field helpers
		_hasFieldDefinition: function(sRef)
		{
			var bFound = false;

			for(var sListIdx in this.options.search.fields)
			{
				if(this.options.search.fields[sListIdx][sRef] !== undefined)
				{
					bFound = true;
					break;
				}
			}

			return bFound;
		},
		_getFieldDefinition: function(sRef)
		{
			var oFieldDef = null;

			for(var sListIdx in this.options.search.fields)
			{
				if(this.options.search.fields[sListIdx][sRef] !== undefined)
				{
					oFieldDef = this.options.search.fields[sListIdx][sRef];
					break;
				}
			}

			return oFieldDef;
		},

		// Message helper
		_cleanMessageArea: function()
		{
			this.elements.message_area
				.hide()
				.html('')
				.removeClass('message_error');
		},
		_setErrorMessage: function(sMessage)
		{
			this.elements.message_area
				.addClass('message_error')
				.html(sMessage)
				.show();
		},

		// Button handlers
		_onSubmitClick: function(oEvent)
		{
			// Assertion: the search is already up to date
			this._submit();
		},


		// Submit handlers
		// - External event callback
		_onSubmit: function()
		{
			this._submit();
		},
		// - Do the submit
		_submit: function()
		{
			var me = this;

			// Data
			// - Regular params
			var oData = {
				'params': JSON.stringify({
					'base_oql': this.options.search.base_oql,
					'criterion': this.options.search.criterion,
				}),
			};
			// - List params (pass through for the server), merge data_config with list_params if present.
			var oListParams = {};
			if(this.options.data_config_list_selector !== null)
			{
				var sExtraParams = $(this.options.data_config_list_selector).data('sExtraParams');
				if(sExtraParams !== undefined)
				{
					oListParams = JSON.parse(sExtraParams);
				}
			}
			$.extend(oListParams, this.options.list_params);
			oData.list_params = JSON.stringify(oListParams);

			// Abort pending request
			if(this.submit.xhr !== null)
			{
				this.submit.xhr.abort();
			}

			// Show loader
			this._showLoader();
			this._cleanMessageArea();

			// Do submit
			this.submit.xhr = $.post(
				this.options.endpoint,
				oData
			)
				.done(function(oResponse, sStatus, oXHR){ me._onSubmitSuccess(oResponse); })
				.fail(function(oResponse, sStatus, oXHR){ me._onSubmitFailure(oResponse, sStatus); })
				.always(function(oResponse, sStatus, oXHR){ me._onSubmitAlways(oResponse); });
		},
		// - Called on form submit successes
		_onSubmitSuccess: function(oData)
		{
			this.elements.results_area.html(oData);
		},
		// - Called on form submit failures
		_onSubmitFailure: function(oData, sStatus)
		{
			if(sStatus === 'abort')
			{
				return false;
			}

			// Fallback message in case the server send back only HTML markup.
			var oErrorElem = $(oData.responseText);
			var sErrorMessage = (oErrorElem.text() !== '') ? oErrorElem.text() : Dict.Format('Error:XHR:Fail', '');

			this._setErrorMessage(sErrorMessage);
		},
		// - Called after form submits
		_onSubmitAlways: function(oData)
		{
			this._hideLoader();
		},


		// Global helpers
		_refreshRecentlyUsed: function()
		{
			me = this;

			var aHistory = me.element.search_form_handler_history("getHistory");
			var oRecentsItemsElem = me.element.find('.sf_list_recents .sfl_items');

			if (aHistory.length == 0)
			{
				return;
			}
			oRecentsItemsElem.empty();


			aHistory.forEach(function(sFieldRef) {
				var oFieldElem = me._getHtmlLiFromFieldRef(me, sFieldRef, ['zlist', 'others']);
				oRecentsItemsElem.append(oFieldElem);
			});

		},
		// - Show loader
		_showLoader: function()
		{
			this.elements.results_area.block();
		},
		// - Hide loader
		_hideLoader: function()
		{
			this.elements.results_area.unblock();
		},
		// - Converts a snake_case string to CamelCase
		_toCamelCase: function(sString)
		{
			var aParts = sString.split('_');

			for(var i in aParts)
			{
				aParts[i] = aParts[i].charAt(0).toUpperCase() + aParts[i].substr(1);
			}

			return aParts.join('');
		},
		// - Extract sParameter from sUrl
		_extractURLParameter: function(sUrl, sParameter) {
			//prefer to use l.search if you have a location/link object
			var urlparts= sUrl.split('?');
			if (urlparts.length>=2) {

				var prefix = [
					sParameter+'=',
					encodeURIComponent(sParameter)+'='
				];
				var pars = urlparts[1].split(/[&;]/g);

				for (var i = 0; i < pars.length; i++) {
					for (var j = 0; j < prefix.length; j++) {
						var pos = pars[i].lastIndexOf(prefix[j], 0);
						if (pos !== -1) {
							return pars[i].substring(pos + prefix[j].length);
						}
					}
				}
			}
			return '';
		},


		// Debug helpers
		// - Show a trace in the javascript console
		_trace: function(sMessage, oData)
		{
			if(window.console)
			{
				if(oData !== undefined)
				{
					console.log('Search form handler: ' + sMessage, oData);
				}
				else
				{
					console.log('Search form handler: ' + sMessage);
				}
			}
		},
		// - Show current options
		showOptions: function()
		{
			this._trace('Options', this.options);
		}
	});
});
