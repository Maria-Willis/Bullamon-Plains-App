// Bullamon Plains -- offline app shell.
//
// This caches the app's own files (not your farm data -- that's handled
// separately by the app itself, in localStorage) so the page can still
// open with no signal at all. Bump CACHE_NAME whenever the list of shell
// files below changes, OR whenever the *contents* of a file already in that
// list change (e.g. a recoloured icon, a new manifest.json) -- otherwise a
// device that already has this service worker installed keeps serving the
// old cached copy of that file indefinitely, even after the real file on
// the server has changed. (Bumped 2026-09-24: the green icon files were
// recoloured to blue, but devices with the old service worker were still
// showing the old green favicon/PWA icon from this cache until this bump.)
// (Bumped again 2026-09-25: index.html changed -- machinery icons moved to
// real files under icons/machinery/, plus the dashboard-issue-reappearing
// fix -- and the dozer/loader icon files themselves changed twice in the
// same day. Devices that had already loaded any of the old versions were
// still stuck on stale cached copies of index.html and/or the icon files
// until this bump, even after a fully successful GitHub/Vercel deploy.)
// (Bumped again 2026-09-25, later the same day: index.html changed again --
// Dashboard delete buttons added/opened up for the issues and reminders
// cards. Same reasoning as above; bumping every time index.html's contents
// change is now the standing practice, not a one-off.)
// (Bumped again 2026-09-25, a third time the same day: added a small visible
// APP_BUILD version tag in the sidebar next to the Refresh app button --
// after Maria correctly did everything right (uploaded both files, deploy
// succeeded) and still couldn't tell whether her device had picked up the
// changes, since there was no way to check that without comparing raw file
// contents. This tag now makes that instantly visible on-screen.)
// (Bumped again 2026-09-25, a fourth time the same day: removed the
// "Report a machinery issue" card from the Dashboard, at Maria's request.)
// (Bumped again 2026-09-25, a fifth time the same day: Safety Data Sheets
// redesigned into a searchable list + a categorised single-product detail
// page, with several brand new optional fields.)
// (Bumped again 2026-09-25, a sixth time the same day: 15 chemicals'
// worth of SDS detail filled in from real, cited web research at Maria's
// request, plus a display-bug fix so already-researched chemicals' poison
// schedule/signal word are no longer hidden on the new detail page.)
// (Bumped again 2026-09-27: the Bulls table is now directly editable cell by
// cell, like a real spreadsheet -- Tag/Name/Animal ID/DOB/Price, every
// year's test result, and the Notes text all edit in place now, instead of
// only through the Edit panel below the table.)
// (Bumped again 2026-09-27, a second time the same day: Animal ID removed
// entirely from the Bulls table and the add/edit-bull form; 2022 and 2023's
// year columns archived (hidden, not deleted -- restorable any time from
// "Show archived years"); admins can now archive/restore/add year columns
// from the table itself, instead of that list being fixed in code.)
// (Bumped again 2026-09-27, a third time the same day: a row's cells only
// become editable after clicking a new "Edit" button on that row, instead
// of always being live inputs -- touching a cell was triggering edit mode
// with no explicit action first, and also made a long test result need
// scrolling inside a cramped textarea to read. 2021's year column archived.
// Price moved to the end of the row, after Notes.)
// (Bumped again 2026-09-28: printing the Bulls list was overcrowded and
// unreadable, with test results getting hard-clipped mid-word/mid-sentence
// (the old design forced exactly 2 pages by clamping every cell to 2 lines,
// no matter how long its text was). That hard clip is now removed entirely
// -- every row is as tall as its content genuinely needs -- and the print
// font/padding enlarged, at the cost of the list now printing across 4
// pages instead of 2. Also: adding a new Bulls year column now accepts
// "<year> Retest" (e.g. "2026 Retest"), not just a plain 4-digit year.)
// (Bumped again 2026-09-28, a second time the same day: a newly added Bulls
// year column now lands to the left of the current year's own column
// instead of wherever plain year-number sorting put it -- fixes "2026
// Retest" landing to the right of "2026" instead of to its left.)
// (Bumped again 2026-09-28, a third time the same day: a one-time migration
// fixes the same left/right ordering for any year column added before that
// fix existed (e.g. an already-saved "2026 Retest" that was still sitting
// to the right of "2026"). Also added a "Delete" button per year column
// (active or archived) to permanently remove a column added by mistake --
// separate from Archive/Restore, which only hide/show a column. Deleting
// never touches any bull's own test-log data underneath.)
// (Bumped again 2026-09-28, a fourth time the same day: Machinery Maintenance
// restructured to match Maria's reference mockups -- a machine's detail
// screen is now Overview/Parts/History/Issues tabs instead of always-visible
// stacked sections; issues now carry a severity (Minor/Needs repair/Unsafe),
// with "Out of action" redefined to mean specifically an open Unsafe issue;
// each issue gets a running "Action taken" timeline instead of a single
// edit/resolve; a new unified "Log work" screen (Service or Other work)
// records a completed-items checklist and parts used; Parts gained a Qty
// column, search, and a copy-part-number button. New "machinery-photos"
// Supabase Storage bucket added to this cache's storage-file matching, for
// issue/action photos -- requires running supabase-storage-setup-
// machinery.sql once, same as the "maps"/"bulls" buckets did.)
// (Bumped again 2026-09-28, a fifth time the same day: two mobile/data bugs
// in the new Machinery Maintenance restructure fixed -- (1) the Overview/
// Parts/History/Issues tab strip on a narrow phone screen ran wider than
// the machine's card and spilled out past its right border ("the Issues is
// outside the borders"); it now scrolls horizontally within the card
// instead, like a long table already did. (2) The "Parts used" picker on
// Log Work/Add action taken rendered as completely blank -- no input at
// all -- for any machine with no parts yet recorded under Parts & Part
// Numbers ("The parts used section is blank. You can't add anything to
// it"); it's now a free-text box (with autocomplete from the machine's own
// parts list when it has any) that always renders, catalogued or not.)
// (Bumped again 2026-09-28, a sixth time the same day: what used to be the
// "History" tab in the Machinery Maintenance restructure is now "Service
// Schedule", at Maria's request ("the service schedule is now in history.
// It should be under Service Schedule"). It now leads with the "Due at next
// service" checklist (moved here from the Overview tab -- same underlying
// data, just shown/edited from this tab now) and the maintenance-schedule
// admin controls, with the completed service-history table and "Delete all
// service history" underneath, same tab. Overview keeps its status card and
// the Log service/Log other work/Report issue buttons -- Log service still
// opens the same quick Log Work form as before, reading the same checklist.)
// (Bumped 2026-09-29: sdsWebResearchV2 migration fills hazard/first-aid
// data for 28 more SDS chemicals from genuine researched sources.)
// (Bumped again 2026-09-29: every SDS chemical detail page now has a
// "Find the current SDS" card linking to Infopest/APVMA.)
// (Bumped again 2026-09-29: corrected a safety-critical error introduced by
// sdsWebResearchV2 (Spraytop 250 / csheet_159 was wrongly listed as diquat,
// corrected to paraquat), flagged six other data-identity discrepancies, and
// filled real sourced data for 58 more chemicals via sdsWebResearchV3.)
// (Bumped again 2026-09-29: Maria pointed out Infopest is defunct (closed
// 31 Jan 2024) -- the "Find the current SDS" card now links to the live
// APVMA PubCRIS register plus a per-product web search instead.)
// (Bumped again 2026-09-29: added a "Search APVMA" button to the main
// Safety Data Sheets list page too, at Maria's request, not just the
// per-chemical detail page.)
// (Bumped again 2026-09-30: sdsWebResearchV4 fills real sourced hazard/first
// aid data for 22 more chemicals -- the last "batches 11-14" that were never
// actually researched, plus gaps in 7 chemicals sdsWebResearchV3 had already
// partially filled -- corrects a wrong APVMA number for Safari Farmoz
// (csheet_150), and flags 5 more chemicals as genuinely ambiguous/not-found
// rather than guessed (Triad, Verno Tanuki, Veteran C Powder, Victory,
// Wizard Adama).)
// (Bumped again 2026-09-30: new Receipts section -- snap/upload a photo of
// a receipt, which the app then emails on automatically via a new Vercel
// serverless function (api/send-receipt.js) and Resend. See
// RECEIPT_EMAIL_SETUP.md for the one-time setup this needs.)
// (Bumped again 2026-10-01: new Harvest Dockets section -- logs each truck
// load of wheat/chickpeas leaving the paddock (matching Maria's real paper
// docket book), auto-emails a copy to the truck driver (picked from a saved
// drivers list), and can export/email the whole log as Excel. Two new
// Vercel serverless functions (api/send-docket.js, api/send-harvest-
// export.js) and a new client-side library (SheetJS, for building the
// Excel file) -- see HARVEST_DOCKET_SETUP.md. SheetJS added to
// CROSS_ORIGIN_ASSETS below so the export button still loads offline on a
// device that's used it before.)
// (Bumped again 2026-10-01, later the same day: Harvest Dockets follow-ups --
// saved drivers now also remember their usual carrier/rego (auto-filling
// both when that driver is picked on a docket), Paddock is now a per-
// property dropdown staff build up over time via "+ Add a new paddock..."
// instead of free text, and the Harvest Dockets nav icon was changed from
// a truck to a wheat sheaf, recoloured blue to match the app's accent
// colour. index.html only -- no shell-asset list changes this time.)
// (Bumped again 2026-10-01, later still: saved drivers can now be edited in
// place (name/carrier/rego/email), not just added/removed -- an inline Edit
// form on each driver row, same ui.editing.<section> pattern already used
// for jobs/machinery/bulls/SOPs. index.html only.)
// (Bumped again 2026-10-01, later still: Property and Commodity are now
// staff-maintained lists too (same "+ Add a new ..." pattern as Drivers and
// Paddocks), seeded with the previous hardcoded values so nothing already
// in use disappears. A driver's Rego is now a LIST, not one fixed value --
// the same person can turn up in different trucks/trailers on different
// days, so Rego is picked (or added) per docket from a dropdown scoped to
// whichever driver is selected, the same cascading pattern as Property ->
// Paddock. Also: the Harvest Dockets nav icon's wheat-sheaf emoji was
// rendering as a plain blue circle on at least one real device -- replaced
// with a small hand-drawn inline SVG icon (coloured via currentColor, so it
// still goes light/dark correctly when the nav item is active) instead of
// relying on a colour-emoji font plus a CSS filter, which isn't reliable
// across browsers/devices. index.html only.)
// (Bumped again 2026-10-02: admin-only "Manage paddocks" panel added to
// correlate/edit which property a paddock belongs to. Docket numbers now
// carry a year prefix ("2026-001"), with an admin-editable "Docket year"
// setting (resets the count when changed, e.g. to "2027" next season).
// Harvest Dockets can now be archived as a whole season (admin-only,
// empties the active list) and reinstated later from "Archived seasons".
// Also: the main menu's item names (not just its headings) can now be
// renamed by an admin from the Sidebar menu card on the Team page.
// index.html only.)
// (Bumped again 2026-10-02, later the same day: admin-only "Manage
// properties" panel added, same shape as "Manage paddocks" -- rename or
// remove a property, with renames cascading to any paddocks linked to it so
// they don't turn into orphans. index.html only.)
// (Bumped again 2026-10-02, a third time the same day: a logged docket can
// now be edited -- including one already emailed to its driver -- by
// anyone, not just admins. Editing re-sends the corrected docket to the
// driver automatically if one's on file, and the docket is permanently
// marked "Edited" (with when/by whom) everywhere it's shown, including in
// Archived seasons and the Excel export, so a corrected docket never looks
// identical to an untouched one. index.html only.)
// (Bumped again 2026-10-02, a fourth time the same day: every field on the
// Add/Edit docket form is now mandatory -- including the conditionally
// shown ones (new driver/commodity/property/paddock/rego name, silo
// number, bunker location, contract no., buyer/merchant), which only
// become required once their section is actually shown. Only the "Ex
// Farm" checkbox stays optional, since a checkbox can't sensibly be forced
// to a single value. index.html only.)
// (Bumped again 2026-10-02, a fifth time the same day: the docket form's
// Rego field now lists every driver's saved regos up front, grouped by
// driver, so a rego can be picked before a driver's even chosen -- e.g.
// ticking trucks off as they arrive by plate. Picking one now auto-selects
// its owning driver (and pulls in their usual carrier), the same way
// picking a driver already auto-filled their regos/carrier. Picking a
// driver directly still narrows the Rego list back down to just their own,
// unchanged. index.html only.)
// (Bumped again 2026-10-02, a sixth time the same day, three small related
// changes: (1) the docket form's Paddock field no longer offers "+ Add a
// new paddock..." -- paddocks are now only ever created via the admin-only
// "Manage paddocks" panel; (2) an edited docket's re-sent email now says so
// right in its own name -- subject and body both read "Delivery Docket
// #2026-001 - Edited" -- so a corrected docket never looks, in the
// driver's inbox, identical to the original it's replacing; (3) an admin
// can now Remove a docket even from an already-archived/"completed"
// season (Archived seasons still never offers Edit there). index.html and
// api/send-docket.js.)
// (Bumped again 2026-10-02, a seventh time the same day: logging, editing
// and removing a docket are now conflict-safe the same way machinery
// issues already were -- if two people save at the exact same moment (or
// 3 people are logging dockets with no signal and reconnect one after
// another), a save conflict now replays the in-flight change against
// whatever the team's latest copy turns out to be, instead of silently
// discarding it. Nothing visible changes day to day; this only matters in
// that narrow same-moment-save window. index.html only.)
// (Bumped again 2026-10-02, an eighth time the same day: a team member can
// now be flagged "Harvest dockets only" on their staff record (Team page),
// at Maria's request ("Can you enable a feature so that there are some
// people that can only access harvest dockets"). A flagged person's sidebar
// shows nothing but Harvest Dockets, they land straight on it when they
// sign in, and the section-rendering logic itself (not just the sidebar)
// refuses to show them anything else -- so there's no other path in the
// app, direct or indirect, that gets them to Machinery, Chemicals, Team,
// etc. Admin status always overrides the flag, so nobody can accidentally
// lock an admin out of the rest of the app. index.html only.)
// (Bumped again 2026-10-02, a ninth time the same day: the docket form's
// "Delivered to" field no longer defaults to GrainCorp (or anything else)
// -- it opens on a blank, disabled placeholder option instead, so the form
// won't validate until someone actually picks where the load is going. At
// Maria's request: "Do not let the delivered to section sit on GrainCorp
// because if they miss this section they could all go through to
// GrainCorp. Force them to make a selection." Applies to both the Add and
// Edit docket forms. index.html only.)
// (Bumped again 2026-10-02, a tenth time the same day: five more
// per-person permission flags on a staff record (Team page), all shipped
// together. "Can add parts to machinery records" lets someone add a new
// part/component to a machine's Parts tab without full admin (editing or
// deleting a part already on file stays admin-only). "Full access to
// Machinery Maintenance" and "Full access to Operating Procedures" each
// grant admin-equivalent access, but only inside that one section --
// nothing else in the app. "Can view uploaded receipts" flips the usual
// shape: uploading a receipt stays open to every signed-in person exactly
// as before, but seeing the list of what's already been uploaded is now
// gated, with a plain-text explanation shown instead for anyone without it.
// And the Harvest "Export & email (Excel)" button (and the function behind
// it) is now admin-only, where it was previously open to everyone. At
// Maria's requests: "Give permission to certain people to add parts to the
// machinery section", "Allow certain people full access to the machinery
// maintenance and operating procedures", "only give certain people access
// to view the receipts that have been uploaded. Everyone can enter a
// receipt but only certain people can see them", and "only admin and
// export and email harvest dockets". index.html only.)
// (Bumped 2026-10-03: each machinery icon now sits in a white tile with a
// solid blue border, instead of the previous faint blue-tinted wash --
// at Maria's request ("put the machinery icons in a blue box and make the
// background white"). Pure styling (.machine-photo in the <style> block),
// same on the fleet-list's small tiles and a machine's own larger detail
// tile. index.html only.)
// (Bumped again 2026-10-03: Safety Data Sheets editing gets real add/remove
// row controls instead of "one point per line"/"Label: Value per line"
// textareas, for PPE points, Storage points, Application limits, Buffer
// distances, and Withholding (harvest/grazing) -- at Maria's request ("I
// need to be able to add and remove items when editing safety data
// sheets"). Each row has its own × button, plus a "+ Add..." button at the
// end of each list; saved data shape is unchanged (still arrays of strings
// or {label,value} pairs), so every chemical's existing SDS data displays
// and edits exactly as before. index.html only.)
// (Bumped again 2026-10-03: SDS section redesign at Maria's request, to
// match a reference screenshot she sent of a product's "SDS preview" --
// adds four new optional fields per chemical (Hazard statements,
// Precautions, Hazard category, GHS pictograms), shown as a new preview
// card on a chemical's detail page (with "View GHS label"/"View SDS"
// buttons to chemicalsafety.com) whenever at least one of them is filled
// in via the Add/Edit SDS form. Also replaces the "Find the current SDS"
// card's two buttons with a single "Search for SDS" button pointing to
// https://chemicalsafety.com/sds-search/ (was "Search the APVMA product
// register" + "Search the web for this product's label", both now
// removed). index.html only.)
// (Bumped again 2026-10-03: "Search for SDS" button's link changed from
// chemicalsafety.com/sds-search/ to https://cottonaustralia.com.au/sds, at
// Maria's follow-up request ("change the linked 'search for sds' to
// https://cottonaustralia.com.au/sds"). The "View GHS label"/"View SDS"
// buttons on the new SDS preview card are unaffected -- she named this one
// button specifically. index.html only.)
// (Bumped again 2026-10-03: a copy of the "Find the current SDS"/"Search
// for SDS" card now also appears at the top of the Safety Data Sheets LIST
// page (above "Safety data sheets"), not just on a chemical's own detail
// page -- at Maria's request ("Move a copy of the Search for Safety Data
// Sheets to the safety data sheets page"). Same link
// (cottonaustralia.com.au/sds); the original copy on each chemical's detail
// page is unchanged. index.html only.)
// (Bumped again 2026-10-03, several related SDS tweaks requested together:
// "Call Poisons Info 13 11 26" now sits at the very top of both a
// chemical's own page and the Safety Data Sheets list page (in addition to
// its existing spot in First aid); "View GHS label"/"View SDS" and the "SDS
// PREVIEW" label are removed from the hazard-statements/precautions/
// category/pictograms card, which itself moved from near the top of a
// chemical's page down to the very end; the GHS pictogram picker/display
// widened (labels were "a little squashed") and gained a 10th, separately
// grouped "Do not induce vomiting" first-aid icon (blue-bordered, not one
// of the 9 official red GHS hazard diamonds); the Safety Data Sheets list
// page's "Search the web ↗"/"Search APVMA ↗" buttons and the "Search the
// web for it instead" empty-state link are removed entirely; and the
// chemical list on that page is now sorted alphabetically by product name
// instead of raw import order. index.html only.)
//
// v45 (2026-10-03): Maria forwarded 20 real product SDS/label PDFs (eChem
// Australia and one CropSure product) after a direct website fetch failed.
// Added migrations sdsPdfFillV7 (enriches 9 existing bare generic-name
// chemical rows -- Abamectin, Acetamiprid, Alpha Duo, Amicide, Amine,
// Atrazine 900, Chlorsulfuron, Clethodim, Clodinafop -- with full
// SDS/label data, including real GHS hazard statements/precautions/
// categories/pictograms for the first time) and sdsNewChemicalsV4 (adds 11
// brand-new chemicals not already on the register: eChem Amitraz 200
// EC/ULV, Amitrole T 250, eChem Bifenthrin 100 EC, eChem Chlorpyrifos 500,
// eChem Clethodim 360 EC, eChem Clopyralid 600, CropSure Beast 200
// Herbicide, eChem Dicamba 500, eChem Difen 500 SC, eChem Chlorothalonil
// 900 WG, and eChem Clopyralid 300 -- the last two share a generic name
// with existing bare rows csheet_38/csheet_42 but describe a different
// real-world formulation/concentration/salt, so were added as new rows
// instead of merged). index.html only.
//
// v46 (2026-10-03.8): a further batch of 20 new eChem/CropSure PDFs --
// 3 safely enriched existing bare generic-name rows with GHS card data
// (Flumioxazin/csheet_81, Indoxacarb/csheet_100, Lambda-cyhalothrin/
// csheet_110) and 17 added as brand-new rows (csheet_216-csheet_232)
// because every other existing candidate match was already attributed
// to a specific different brand, or had a conflicting GHS signal
// word/hazard-category claim on file. index.html only.
//
// v47 (2026-10-03, batch 9): 20 more real eChem/CropSure product PDFs,
// all added as brand-new rows (csheet_233-csheet_252) -- no enrichment
// pass this batch, since every existing candidate match for this
// batch's active ingredients was already attributed to a specific
// different brand. index.html only.
//
// v48 (2026-10-04): two bug fixes Maria reported after testing with no/poor
// signal. (1) "Very slow to load or it simply won't load" -- boot()'s
// initial Supabase read had no timeout, so on a POOR (not dead) signal the
// request could just hang indefinitely with nothing to fall back to the
// device's own offline copy; it's now raced against a 7s timeout, same
// fallback as a hard failure. (2) "Defaulting to Clinton as the driver no
// matter who you select" on the Harvest Docket form -- handleRegoSelectChange
// re-derived the Driver field's owner from the picked rego EVERY time, even
// once a driver was already explicitly chosen and the Rego dropdown was
// already scoped to just that driver, so a rego duplicated (by mistake)
// across two drivers' saved lists silently flipped the form back to
// whichever driver came first in storage order. Now only auto-resolves the
// driver from a picked rego when no driver is selected yet (the intentional
// "pick rego first" workflow this was built for). index.html only.
//
// v49 (2026-10-04, later the same day): follow-up fix for a false "Someone
// else saved changes while this device was offline" conflict message Maria
// hit immediately after v48 shipped, entering harvest dockets with poor
// signal. v48's new boot timeout could leave a device booted from its own
// cached copy of the data, which can itself already be a version behind the
// true current one (just a stale snapshot from an earlier visit) -- so the
// FIRST offline edit from that stale starting point got queued with a stale
// "before" version, and the next sync wrongly reported someone else's
// change and discarded the edit for manual re-entry, even though nobody
// else had actually changed anything. The real (slow) request now keeps
// running in the background after the timeout fallback, and if it lands
// before any offline edit has been queued, it quietly catches the device up
// to the true latest copy first -- an edit already queued by the time it
// lands is left untouched, so a genuine conflict (someone else really did
// save first) is still caught and handled exactly as before. index.html
// only.
//
// v50 (2026-10-04, later still): map photos on the Maps page now have a
// "Print" button (photo scaled to fit one sheet, title/notes as a caption);
// PDF maps' button now reads "Open PDF to print". Also: the machinery
// Overview tab's Log service / Log other work / Report issue buttons are
// larger, and the Overview/Parts/Service Schedule/Issues tab strip is now
// four equal boxes that all fit on a phone screen at once. index.html only.
// v51 (2026-10-04, later still): the phone's back button now steps back one
// screen at a time (machine -> issue -> back lands on the machine, not the
// main menu) -- index.html changed, so the cached copy must refresh.
// v52 (2026-10-04, later still): machinery Parts list gains a Brand field
// (column, add/edit form input, searchable) -- index.html changed.
// v53 (2026-10-04, later still): a part / component can now list several
// brands, each with its own part number -- index.html changed.
// v54 (2026-10-05): new per-person "Limited access" setting on the Team page
// (Dashboard, Jobs, Maps, Emergency, WHS, Safety Data Sheets, Operating
// Procedures & Harvest Dockets only) -- index.html changed.
// v55 (2026-10-05, later): main menu now has a blue background with bigger
// button text -- index.html changed.
// v56 (2026-10-05, later): menu button text trimmed slightly smaller --
// index.html changed.
// v57 (2026-10-05, later): menu button text trimmed a bit smaller again --
// index.html changed.
// v58 (2026-10-05, later): admins can change each main-menu item's icon
// (Team page > Sidebar menu) -- index.html changed.
// v59 (2026-10-05, later): page background cream -> light grey, light grey
// panels -> light blue -- index.html changed.
// v60 (2026-10-05, later): the light blue panels are now white --
// index.html changed.
// v61 (2026-10-05, later): every emoji in the app is now drawn in blue --
// index.html changed.
// v62 (2026-10-06): emoji replaced with proper line icons (menu, buttons,
// icon picker) -- index.html changed.
// v63 (2026-10-06, later): menu icon picker gets ~80 icons with a search box,
// "Upload my own picture", and an "Edit menu icons" shortcut on the menu --
// index.html changed.
// v64 (2026-10-06, later): box outlines blue, headings blue -- index.html changed.
// v65 (2026-10-06, later): machinery Overview/Parts/Service Schedule/Issues
// tab buttons redesigned (bigger, icons, 2x2 on phones) -- index.html changed.
// v66 (2026-10-07): harvest docket form field headings in blue -- index.html changed.
// v67 (2026-10-07, later): Operating Procedures machine titles stand out more --
// index.html changed.
// v68 (2026-10-07, later): machine titles back to original size; the machine itself
// (group heading / stand-alone machine name) highlighted in blue -- index.html changed.
// v69 (2026-10-07, later): highlight on each machine name, not the group heading -- index.html changed.
// v70 (2026-10-07, later): highlight on the group heading (e.g. JD8120 & WEED-IT) only -- index.html changed.
// v71 (2026-10-07, later): grouped procedures no longer show the second "title - category" line -- index.html changed.
// v72 (2026-10-07, later): parts Edit form opens under the part; note notifications stay on after sign out/in -- index.html changed.
// v73 (2026-10-07, later): PDF maps get a real Print button (straight to the print dialog) -- index.html changed.
// v74 (2026-10-07, later): page background light grey -> light blue -- index.html changed.
// v75 (2026-10-09): page background same blue as the main menu (text on the page turned white) -- index.html changed.
// v76 (2026-10-12): Edit machine "Next service due" is now hours, not a date -- index.html changed.
// v77 (2026-10-12, later): "Edit next service due" button on the machine page -- index.html changed.
// v78 (2026-10-12, later): Schedule & history "Next due" row matches maintenance status and its hours are editable -- index.html changed.
// v79 (2026-10-12, later): "current reading" hours no longer shown on the machine page -- index.html changed.
// v80 (2026-10-12, later): "Edit hours" on each Schedule & history row -- index.html changed.
// v81 (2026-10-12, later): no "hrs to go"; maintenance schedule ignores starting hours -- index.html changed.
// v82 (2026-10-12, later): old next-service dates no longer shown ("Next service not set" until hours entered) -- index.html changed.
// v83 (2026-10-12, later): Starting hours kept as a record (Edit machine + Overview), not used by the schedule -- index.html changed.
// v84 (2026-10-12, later): Private > Information card gets an "Import summary" paste box -- index.html changed.
// v85 (2026-10-12, later): Private "Information" card renamed Cropping Summary -- index.html changed.
// v86 (2026-10-13): Receipts upload button now reads "Take Photo / Choose File" -- index.html changed.
// v87 (2026-10-13, later): Sold / Dead bulls table shows the latest years incl. retests -- index.html changed.
// v88 (2026-10-13, later): new "My Time in Lieu" section -- index.html changed.
// v89 (2026-10-13, later): My Time in Lieu shows the balance only (Earned/Taken tiles removed) -- index.html changed.
// v90 (2026-10-13, later): staff can change their own access code -- index.html changed.
// v91 (2026-10-13, later): removing/deactivating staff also stops their note notifications -- index.html changed.
// v92 (2026-10-16): new "Time Sheets" section (fortnightly employee time sheet, print, email) -- index.html changed.
// v93 (2026-10-16, later): time sheet nett hours treat the first 30 mins of breaks as paid -- index.html changed.
// v94 (2026-10-16, later): time sheet fields no longer jump back while typing -- index.html changed.
// v95 (2026-10-16, later): clearer message when the time sheet email function is not uploaded (HTTP 404) -- index.html changed.
// v96 (2026-10-16, later): time sheet paid 30 mins applies to smoko only; lunch always deducted -- index.html changed.
// v97 (2026-10-16, later): new "Silo Storage" section -- index.html changed.
// v98 (2026-10-16, later): Silo Storage button renamed "Edit silo & crop" -- index.html changed.
// v99 (2026-10-16, later): Silo Storage forms keep what you typed, show errors inside the form -- index.html changed.
// v100 (2026-10-16, later): Silo Storage column layout like the Airstrip drawing, add new headings -- index.html changed.
// v101 (2026-10-16, later): Silo Storage columns line up in rows; bold silo number badges -- index.html changed.
// v102 (2026-10-16, later): Silo Storage capacity is a hard limit -- index.html changed.
// v103 (2026-10-16, later): Silo Storage heading name bigger, clearer North arrow -- index.html changed.
// v104 (2026-10-16, later): Silo Storage rotatable compass marker replaces the north text -- index.html changed.
// v105 (2026-10-16, later): compass has no circle; N stays upright at the arrow tip -- index.html changed.
// v106 (2026-10-16, later): Silo Storage fill levels required; silos can never go below empty or over full -- index.html changed.
// v107 (2026-10-16, later): Silo Storage silos sized by fill level, columns end level, F silos plain tank shape, Airstrip fill levels -- index.html changed.
// v118 (2026-10-16, later): text in the silo circles is sized to the circle and trimmed so it always fits -- index.html changed.
// v119 (2026-10-18): new Fuel Storage section (Mungindi and Thallon tanks, litres in/out/transfer/dip level) -- index.html changed.
// v120 (2026-10-18, later): menu items missing from the Team page's movable menu list (Fuel Storage, Silo Storage...) are now listed there so an admin can move them -- index.html changed.
// v121 (2026-10-18, later): search bar on the Fuel Storage page -- index.html changed.
// v122 (2026-10-18, later): an admin chooses who can use Fuel Storage (tick per person) -- index.html changed.
// v123 (2026-10-18, later): Dashboard items open their section when tapped -- index.html changed.
// v124 (2026-10-18, later): machinery parts get a "replace every X hours" schedule that shows (and can be edited) in the Service Schedule tab -- index.html changed.
// v125 (2026-10-18, later): parts due at a service are listed on "Log this service" as a checklist (ticking records the replacement) and on the schedule rows / Overview -- index.html changed.
// v126 (2026-10-18, later): "Import John Deere hours" on the Machinery page (reads the Ops Centre Service Overview export, updates hour readings only) -- index.html changed.
// v127 (2026-10-18, later): offline edits now merge with the team's newer saves automatically, the "offline" state recovers by itself, "Try now"/Refresh work after a weak-signal start, and an unsynced clash copy survives closing the app -- index.html changed.
// v128 (2026-10-19): live John Deere link -- Connect John Deere + "Update hours from John Deere" on Machinery; service worker now leaves /api/ requests alone -- index.html changed.
// v129 (2026-10-19, later): John Deere machines are now listed from Deere's Equipment API address (the first attempt got a 403) and the "no hours" message names what went wrong -- index.html changed.
// v130 (2026-10-19, later): machinery page shows the status of the daily automatic John Deere hours update -- index.html changed.
// v131 (2026-10-19, later): a save that clashes with someone else's newer save is now combined with it instead of being thrown away (dashboard notes vanishing), and open apps catch up with the team's latest copy when brought to the front / every minute -- index.html changed.
// v132 (2026-10-19, later): time sheet heading (screen, print and email) now reads "Bullamon Plains Pastoral Company" -- index.html changed.
// v133 (2026-10-19, later): access codes are now checked by the server and kept scrambled (not in the shared data); the Private section moved to a locked server table with its own Private code -- index.html changed.
// v117 (2026-10-16, later): Cooks Dam silos 1-4 in one line; silo circles show only crop, where from and tonnes -- index.html changed.
// v116 (2026-10-16, later): the latest entry's description shows inside each silo circle -- index.html changed.
// v115 (2026-10-16, later): silo entries can be edited by anyone and show their description; Jobs form says Job / Job details first -- index.html changed.
// v114 (2026-10-16, later): a harvest docket delivered into an empty silo sets the silo's crop and harvest year -- index.html changed.
// v113 (2026-10-16, later): Silo crop is picked from a list and each silo gets a Year harvested -- index.html changed.
// v112 (2026-10-16, later): Chemical Shed back at the top right; the "All silos" button is bigger and solid -- index.html changed.
// v111 (2026-10-16, later): Silo Storage map flipped bottom-to-top (D8/7/F3 at top) and silo number badges no longer clipped on the left -- index.html changed.
// v110 (2026-10-16, later): Harvest dockets delivered to a silo now add their tonnes to that silo -- index.html changed.
// v109 (2026-10-16, later): Silo Storage shows shed symbols (Chemical, Machinery) to the right of the Airstrip silos, reached by scrolling right -- index.html changed.
// v108 (2026-10-16, later): Silo Storage silos scale to fit narrow phones instead of stacking -- index.html changed.
// v134 (2026-10-20): the app now shows a "new version ready -- Update now" bar when this file changes -- index.html changed.
// v135 (2026-10-20, later): "Email me a copy" button on submitted time sheets -- index.html changed.
// v136 (2026-10-20, later): parts catalogue PDFs on each machine's Parts tab -- index.html changed.
// v137 (2026-10-20, later): Thallon is now the first tab in Fuel Storage -- index.html changed.
// v138 (2026-10-20, later): time sheets get an Annual leave tick per day and feed Time in Lieu; machine hours shown big with source/time; Service Schedule order swapped; receipts visible to their uploader; Chemical Register storage location is a drop-down -- index.html changed.
// v139 (2026-10-20, later): time in lieu can never go below zero (time sheets take only what is available) -- index.html changed.
// v140 (2026-10-20, later): on the time sheet summary only the Total (worked + annual leave) line is bold -- index.html changed.
// v141 (2026-10-20, later): a time sheet can't be submitted when it asks to be paid for more hours than worked + annual leave and there isn't enough time in lieu to cover it -- index.html changed.
// v142 (2026-10-20, later): the time sheet Submit button stays clickable; when there is not enough time in lieu to cover the hours to be paid, clicking it shows a red warning and refuses -- index.html changed.
// v143 (2026-10-20, later): time in lieu entries from a time sheet show only the fortnight dates as the note; the can't-submit warning shows the hours-to-pay less annual leave sum -- index.html changed.
// v144 (2026-10-20, later): time sheet Start/Finish are typed on the number keyboard (0630, 6:30, 1430) with an x to clear -- index.html changed.
// v145 (2026-10-20, later): Team page can archive an employee (access removed, time sheets and time in lieu kept for admins) and restore them -- index.html changed.
// v146 (2026-10-20, later): time sheet times are 12-hour (type 630, tap AM/PM), shown as 6:30 AM in print and email -- index.html changed.
// v147 (2026-10-20, later): empty time sheet time boxes show 0:00 and a faded AM/PM so nothing looks pre-filled -- index.html changed.
// v148 (2026-10-20, later): time sheet clear button is a dash; the grey explanation lines under the hours are gone -- index.html changed.
// v149 (2026-10-20, later): time sheet "Hours you want to be paid for" is bold and its box sits in the same column as the nett and annual hours -- index.html changed.
// v150 (2026-10-20, later): "Time in lieu from this sheet" shows just +4.5 / -4.5 -- index.html changed.
// v151 (2026-10-20, later): Service Schedule tab: Due at next service now sits under Schedule & history -- index.html changed.
// v152 (2026-10-20, later): machines (and parts) only show as due for service within 25 hours of the deadline -- index.html changed.
// v153 (2026-10-20, later): Safety Data Sheets: manufacturer SDS upload + issue date + status, filters, product-name checks, optional hiding of unverified summaries -- index.html changed.
// v154 (2026-10-21): admins get a "Share this app" button in the menu (phone share sheet, or copies the address) -- index.html changed.
// v155 (2026-10-23): Dashboard Notes card gets a DODA section where staff upload a photo (with optional caption) -- index.html changed.
// v156 (2026-10-23, later): DODA entries take several photos and a longer note -- index.html changed.
// v157 (2026-10-23, later): DODA removed; new Bullamon Gallery menu item (photos with a description) -- index.html changed.
// v158 (2026-10-24): Jobs area tabs are big bordered buttons; jobs can be archived and restored -- index.html changed.
// v159 (2026-10-24, later): the selected Jobs area tab has no white border -- index.html changed.
// v160 (2026-10-24, later): Jobs: Priority and the "To do" pill are gone and the job text is larger -- index.html changed.
// v161 (2026-10-24, later): Jobs: the word "General" is no longer shown on a job with no category -- index.html changed.
// v162 (2026-10-24, later): Jobs: the job details wording under each job is bold -- index.html changed.
// v163 (2026-10-24, later): Maps starts with a Bullamon Plains Map picture (this was withdrawn in v164) -- index.html changed.
// v164 (2026-10-24, later): PDF maps show a thumbnail picture of their first page (tap to open the full map) instead of a "PDF map" label -- index.html changed.
// v165 (2026-10-24, later): Machinery overview: the "Parts due at next service" list is compact (one short line per part) -- index.html changed.
// v166 (2026-10-24, later): Machinery overview: parts due at a different reading from the service are grouped under one "Replace at X hrs" line instead of a label on every row -- index.html changed.
// v167 (2026-10-24, later): Operating Procedures: the blue group headings have rounded corners -- index.html changed.
// v168 (2026-10-24, later): Parts tab: the explanation text under "Cross-check before ordering." is removed on every machine -- index.html changed.
// v169 (2026-10-24, later): Biosecurity visitor sign-in: website link button (admin sets it), existing records cleared once, new records can be deleted -- index.html changed.
// v170 (2026-10-24, later): Biosecurity: Visitor & contractor sign-in moved to the top and its website button made much larger -- index.html changed.
// v171 (2026-10-25): new Team tick "Can see everyone's time sheets and time in lieu" (view only), for Ed -- index.html changed.
// v172 (2026-10-26): new Livestock menu item (replacement for AgriWebb: all five farms, mobs, calves at foot, wean/brand, joining, preg test, moves, sales) -- index.html changed.
// v173 (2026-10-26): Livestock section limited to admins for now -- index.html changed.
// v174 (2026-10-26): Livestock head counts now combine correctly when two people change the same mob while out of range; seed ids made fixed so two phones can't double the mobs -- index.html changed.
// v175 (2026-10-27): Livestock paddock map (pick up a mob, drop it on a paddock on any farm); Cedarvale outlines from AgriWebb; boundary import -- index.html changed.
// v176 (2026-10-27, later): Time Sheets: admin Mark paid / Undo paid, paid sheets move to a folder per fortnight; new hours report (one or several employees, custom dates, Print, CSV) -- index.html changed.
// v177 (2026-10-27, later): Livestock: map shows a paddock name only when it fits comfortably; Add new mob (any property, can type a new paddock); mob cards open with Add calves etc. and the form inside the card; add several paddocks at once, copy from Harvest, add a property; West Ginnibri added -- index.html changed.
// v178 (2026-10-27, later): Livestock: Undo and Edit on records (cancel a pregnancy test, calves, move, sale, new mob etc. and put the mob back as it was); old pregnancy tests, calves, moves and recounts can be cancelled too -- index.html changed.
// v179 (2026-10-27, later): Livestock: Age a mob (move it up a class, year goes in the name) and Age/Rename buttons on every mob; choosing a mob in the Age/Rename form fills it in -- index.html changed.
// v180 (2026-10-27, later): Livestock: Age hidden on cows/bulls/ewes/wethers; ageing a Calves mob splits it into steers and heifers (heifer mob named J + last digit of the join year, e.g. J6) -- index.html changed.
// v181 (2026-10-27, later): Livestock: heifer mobs named J6, J7 etc. no longer have the year in front -- index.html changed.
// v182 (2026-10-27, later): Time Sheets: new sheets get 30 minutes of paid break a day however it is taken (only smoko + lunch over 30 comes off); sheets already submitted keep their old hours -- index.html changed.
// v183 (2026-10-28): Fuel Storage: every tank shows the date it was last updated (tile and tank page) -- index.html changed.
// v184 (2026-10-28, later): Silo Storage: "Download all silos (CSV)" button -- one row per silo with crop, year, tonnes, fill level, space left and last entry -- index.html changed.
// v185 (2026-10-28, later): Livestock: Box Plains and West Ginnibri paddock outlines from Maria's AgriWebb export are on the map (one-time, paddocks added by name) -- index.html changed.
// v186 (2026-10-28, later): Livestock: Agistment (send a mob or part of one to a property we don't own; asks for the location) and map colours now match AgriWebb -- index.html changed.
// v187 (2026-10-28, later): Livestock: on All Farms the map has farm buttons so any farm's map can be shown -- index.html changed.
// v188 (2026-10-28, later): Livestock: Bullamon Plains paddock outlines (29) on the map; each paddock drawn in its own AgriWebb colour -- index.html changed.
// v189 (2026-10-28, later): Livestock: Fenton and Nullera outlines, every paddock in its own AgriWebb colour, and the latest AgriWebb mob lists added (mobs already there skipped) -- index.html changed.
// v214 (2026-10-29, night): Private spreadsheet changes get an Accept button; a renamed but same-layout spreadsheet replaces the earlier one so the Summary updates -- index.html changed.
// v213 (2026-10-29, night): Private menu item stays reachable on a phone that has no sign-in proof yet (Ed couldn't see Private) -- index.html changed.
// v212 (2026-10-29, night): Private tables line figures up on the right under their headings -- index.html changed.
// v211 (2026-10-29, night): Private > Dryland > Summary > Location shows Thallon Grains / GrainCorp / Silos -- index.html changed.
// v210 (2026-10-29, evening): Private tabs first on the page; code/access cards moved to the bottom -- index.html changed.
// v209 (2026-10-29, evening): Private has Cotton and Dryland tabs; Dryland has Summary and Harvest tabs -- index.html changed.
// v208 (2026-10-29, later still): Machinery gets Year of manufacture and VIN; Rego / ID is now Rego -- index.html changed.
// v207 (2026-10-29, later): Private takes uploaded spreadsheets and highlights what changed -- index.html changed.
// v206 (2026-10-29, night): Bulls are in the Livestock section (one bull symbol per paddock, one Bulls box) -- index.html changed.
// v205 (2026-10-29, evening): Each livestock mob is in its own box with a shadow -- index.html changed.
// v204 (2026-10-29, later still): Sheep symbol on the livestock map has a dark green tile -- index.html changed.
// v203 (2026-10-29, later): Tapping a mob on the livestock map lists it first -- index.html changed.
// v202 (2026-10-29): Livestock map sheep symbol changed to Maria's new sheep picture -- index.html changed.
// v201 (2026-10-28, later): Livestock map symbols use Maria's cattle and sheep pictures -- index.html changed.
// v200 (2026-10-28, later): Pre-Planting procedures get the checklist symbol -- index.html changed.
// v199 (2026-10-28, later): Operating Procedure symbols are chosen from the row's own title first -- index.html changed.
// v198 (2026-10-28, later): Operating Procedures laid out like Maria's photo, with symbols (sprinkler, plant, pump from her pictures) -- index.html changed.
// v197 (2026-10-28, later): Time Sheets: symbols beside the card headings and main buttons -- index.html changed.
// v196 (2026-10-28, later): Boxes inside boxes (e.g. each fuel tank) get the same shadow -- index.html changed.
// v195 (2026-10-28, later): A shadow on every box and button -- index.html changed.
// v194 (2026-10-28, later): Livestock map runs truly to the edge of the card / screen -- index.html changed.
// v193 (2026-10-28, later): New look from Maria's photos: blue header band, grey page, white rounded cards, tile buttons -- index.html changed.
// v192 (2026-10-28, later): Phone layout: every box runs edge to edge across the full width of the screen -- index.html changed.
// v191 (2026-10-28, later): Livestock map: Full screen button -- the map fills the whole phone screen (farm buttons on top, zoom/Fit/Sat buttons, paddock panel at the bottom, satellite stays on) -- index.html changed.
// v190 (2026-10-28, later): Livestock map: mobs show as a small cow / sheep symbol and only show their names once you zoom in far enough -- index.html changed.
var CACHE_NAME = "bullamon-plains-shell-v214";

var SHELL_ASSETS = [
  "./",
  "./index.html",
  "./config.js",
  "./manifest.json",
  "./icons/favicon.ico",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// The Supabase client library itself, so it's still available to load
// offline -- without this, a device with no cached copy of it yet would
// see window.supabase as undefined and have no way to even try syncing
// once back in range. SheetJS (window.XLSX) is here for the same reason --
// it's what builds the Excel file for the Harvest Dockets export button.
var CROSS_ORIGIN_ASSETS = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache){
        return cache.addAll(SHELL_ASSETS).then(function(){
          return Promise.all(CROSS_ORIGIN_ASSETS.map(function(url){
            return fetch(url, { mode: "no-cors" })
              .then(function(res){ return cache.put(url, res); })
              .catch(function(){ /* offline on first install -- fine, just skip it for now */ });
          }));
        });
      })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys()
      .then(function(names){
        return Promise.all(names.filter(function(n){ return n !== CACHE_NAME; }).map(function(n){ return caches.delete(n); }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event){
  var req = event.request;
  if(req.method !== "GET") return; // never intercept Supabase reads/writes -- those are POST/PATCH, or GETs to a different origin we don't touch below

  var url = new URL(req.url);
  if(url.origin === self.location.origin && url.pathname.indexOf("/api/") === 0) return; // serverless functions (incl. the John Deere sign-in redirect) always go straight to the network
  var isShellCrossOrigin = CROSS_ORIGIN_ASSETS.indexOf(req.url) > -1;
  // Uploaded map photos/PDFs, and bulls' attached PDFs, live in Supabase
  // Storage, a different origin from the app itself -- matched by path
  // rather than a fixed URL (unlike CROSS_ORIGIN_ASSETS above) since it
  // needs to work for any file added to either the "maps" or "bulls"
  // bucket, not just files known in advance.
  var isCachedStorageFile = url.pathname.indexOf("/storage/v1/object/public/maps/") > -1 ||
    url.pathname.indexOf("/storage/v1/object/public/bulls/") > -1 ||
    url.pathname.indexOf("/storage/v1/object/public/machinery-photos/") > -1;
  if(url.origin !== self.location.origin && !isShellCrossOrigin && !isCachedStorageFile) return; // let Supabase's own API calls go straight to the network, untouched

  event.respondWith(
    caches.match(req).then(function(cached){
      var fetchPromise = fetch(req, isShellCrossOrigin ? { mode: "no-cors" } : {})
        .then(function(res){
          if(res && (res.ok || res.type === "opaque")){
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
          }
          return res;
        })
        .catch(function(){ return null; });
      // Serve the cached copy immediately when we have one (fast, and
      // works offline); refresh it in the background either way so the
      // next load picks up anything new once there's a connection again.
      return cached || fetchPromise;
    })
  );
});

// The page (index.html) asks us to proactively download every current map
// photo/PDF and bull-attachment PDF, right after it loads fresh farm data --
// so these still work offline even for a file nobody's actually opened on
// this device yet, not only ones a fetch/<img> has already caused us to
// cache above. Skips anything already cached, so this never re-downloads a
// file that hasn't changed. (Still called "cacheMapFiles" for both kinds of
// file -- see prefetchStorageFilesForOffline() in index.html.)
self.addEventListener("message", function(event){
  var msg = event.data;
  if(!msg || msg.type !== "cacheMapFiles" || !Array.isArray(msg.urls)) return;
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return Promise.all(msg.urls.map(function(url){
        return cache.match(url).then(function(existing){
          if(existing) return; // already have it -- don't re-download
          return fetch(url, { mode: "cors" }).then(function(res){
            if(res && res.ok){ return cache.put(url, res); }
          }).catch(function(){ /* offline, or blocked -- will retry on the next successful sync */ });
        });
      }));
    })
  );
});

// Push notifications -- see "Get notified of new notes" on the Dashboard in
// index.html. A push arrives here from Supabase's notify-new-dashboard-note
// Edge Function (triggered by a database webhook whenever a new Dashboard
// note is added), carrying a small JSON payload -- this just displays it as
// a normal system notification, which is what lets it show up even if
// nobody has the app open at the time.
self.addEventListener("push", function(event){
  var data = {};
  try{
    data = event.data ? event.data.json() : {};
  }catch(e){
    data = { title: "Bullamon Plains", body: event.data ? event.data.text() : "You have a new notification." };
  }
  var title = data.title || "Bullamon Plains";
  var options = {
    body: data.body || "",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    data: { url: data.url || "./" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping the notification focuses an already-open tab if there is one,
// rather than always opening a new one.
self.addEventListener("notificationclick", function(event){
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList){
      for(var i = 0; i < clientList.length; i++){
        if("focus" in clientList[i]) return clientList[i].focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
