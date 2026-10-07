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
var CACHE_NAME = "bullamon-plains-shell-v74";

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
