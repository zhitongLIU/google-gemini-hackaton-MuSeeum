# MuSeeum — Screen Navigation & Implementation Guide

> Reference prototype: `muSeeum.pen`
> Use the Pencil node IDs below so your AI coding agent knows which design to implement for each screen and interactive element.

---

## Screen Inventory

| Screen              | Pencil Node ID | Nav Note ID | Name                                     | Description                                                                                                             |
| ------------------- | -------------- | ----------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Home (with visits)  | `k4vP2`        | `EZErV`     | VisitHome Mobile var 2 - Framed Carousel | Home screen showing existing museum visits in a card carousel                                                           |
| Home (empty)        | `Tu4DF`        | `06wEf`     | VisitHome Mobile - Empty Gallery         | First-time / empty state — no visits yet                                                                                |
| Photo Menu          | `xEPrW`        | `m4N2t`     | VisitHome Mobile - Photo Menu            | Bottom sheet overlay to take or upload a photo                                                                          |
| Museum Picker       | `p39d7`        | `oiBDV`     | VisitHome Mobile - Museum Picker         | Bottom sheet to select which museum the user is visiting                                                                |
| Artwork Analysis    | `vE9pj`        | `Zi4l5`     | Artwork Analysis Result                  | AI-analyzed artwork detail with photo slider, metadata, and like                                                        |
| Museum Gallery Grid | `Ij4bQ`        | `08fOR`     | Museum Gallery Grid                      | TikTok-style grid of all artworks captured at a museum                                                                  |
| Edit Museum         | `XFAXz`        | `k9nEM`     | Edit Museum                              | Change or correct the museum associated with a visit                                                                    |
| Photo Viewer        | `40pgf`        | `wpS4q`     | Photo Viewer                             | Full-screen dark photo viewer with notes                                                                                |
| Collection Stats    | `pz0Fs`        | `Da4aB`     | Collection Stats                         | Stats dashboard: museums visited, artworks per museum, art periods, top artists                                         |
| Favorite Artworks   | `tTm4I`        | `M7WSb`     | Favorite Artworks                        | Grid of all liked/favorited artworks across museums                                                                     |
| Live Identification | `XLRyj`        | `AG3as`     | Live Identification                      | Dark immersive voice-first confirmation via Gemini Live; push-to-talk mic + waveform + transcript; gate before Analysis |

> **Nav Note nodes** are annotation frames in the Pencil file placed below each screen, summarizing clickable elements and their navigation targets. Use `batch_get` with the Nav Note ID to quickly see all interactive targets for a screen.

**Backend agents (two-phase artwork flow):**

- **Art Info Agent:** Vision + Google Search / Wikipedia grounding → identifies artist, museum, date of production, period, title → returns **candidate** for confirmation. Shown on Live Identification (XLRyj).
- **Docent Agent:** Runs **after** user confirms (or 5s timeout with no response). Generates visitor-friendly description and museum-docent presentation. Content appears on Artwork Analysis (vE9pj).

---

## Navigation Flows

### Flow 1: First-Time User — Empty → Capture → Result

```
Tu4DF (Empty Home)
  │
  ├─ [ctaButton: uXA8r] "Start Exploring"
  │   └──▶ xEPrW (Photo Menu — bottom sheet)
  │
  └─ [bottomNav: VvA8k]
      ├─ [tabDiscover: sGBWB] → (Discover tab — not prototyped)
      ├─ [tabMap: iv22K] → (Map tab — not prototyped)
      ├─ [tabVisits: aXjSP] → current screen (active)
      └─ [tabProfile: SgMo4] → (Profile tab — not prototyped)
```

### Flow 2: Photo Menu → Camera or Gallery → Live Identification

**No museum picker.** When the user taps “Take a Photo” or “Upload from Gallery”, the app opens the camera or gallery directly. The Art Info Agent discovers the museum from the artwork image (Google Search/Wikipedia grounding).

```
xEPrW (Photo Menu — bottom sheet over home)
  │
  ├─ [takePhotoOption: wsRn5] "Take a Photo"
  │   └──▶ open device camera → after capture → create session if needed (no museum) → XLRyj (Live Identification)
  │
  ├─ [uploadPhotoOption: qXsz8] "Upload from Gallery"
  │   └──▶ open gallery picker → after image selected → create session if needed (no museum) → XLRyj (Live Identification)
  │
  ├─ [cancelButton: Aa28i] "Cancel"
  │   └──▶ dismiss sheet, return to Tu4DF or k4vP2
  │
  └─ [dimOverlay: vg0oh] tap outside
      └──▶ dismiss sheet
```

### Flow 3: Museum Picker (optional — p39d7)

The Museum Picker is **no longer in the Take Photo / Upload flow**. The agent finds the museum from the artwork. This screen (p39d7) is **optional** for manual override: e.g. “Set museum” or “Where are you visiting?” for users who want to specify or correct the location before or after capture. Nav note: oiBDV.

```
p39d7 (Museum Picker — optional bottom sheet)
  │
  ├─ [sheetTitle] "Where are you visiting? (optional)"
  ├─ [sheetSubtitle] "You can skip this; our agent will identify the museum from your photo."
  │
  ├─ [museumItem1: 4O8Ak] … [museumItem4: TCAKd] select a museum
  │   └──▶ set museum on session (optional) → dismiss or continue to camera
  │
  ├─ [searchField: dpGXb] search for a museum
  ├─ [skipButton: jFg7C] "Skip for now"
  │   └──▶ dismiss; user can take photo without setting museum
  │
  └─ [dimOverlay: qlBQC] tap outside
      └──▶ dismiss sheet
```

### Flow 3b: Live Identification (Voice-First Confirmation)

This screen shows the **Art Info Agent** result (candidate) and collects confirmation before the **Docent Agent** runs.

```
XLRyj (Live Identification — dark immersive)
  │
  ├─ topBar [dYbRM] (white icons on dark bg)
  │   ├─ [backButton: jDuTA] ← (semi-transparent circle)
  │   │   └──▶ xEPrW (Photo Menu) — if came from capture
  │   │   └──▶ Ij4bQ (Gallery Grid) — if came from unconfirmed card
  │   └─ [screenTitle: csxrM] "Live Identification"
  │
  ├─ imageSection [LFhHN] (250px, captured photo)
  │   ├─ [capturedPhoto: vbiJn] — full-width artwork photo
  │   └─ [aiScanBadge: 31v1G] "AI Analyzing..." — sparkles icon
  │       └──▶ while backend runs Art Info Agent (vision + search/Wiki grounding)
  │
  ├─ conversationArea [Pq9qL] — Art Info result + confirmation
  │   ├─ aiSpeakingRow [rG1jd]
  │   │   ├─ [aiAvatar: iWOLg] — 40px gold circle, sparkles icon
  │   │   ├─ waveformGroup [u5H86] — 5 animated gold bars (audio vis)
  │   │   │   ├─ [bar1: dB6Ch] h=10
  │   │   │   ├─ [bar2: k6Cng] h=22
  │   │   │   ├─ [bar3: XPLxt] h=14
  │   │   │   ├─ [bar4: vlsK2] h=26
  │   │   │   └─ [bar5: CrQjJ] h=16
  │   │   └─ [speakingLabel: cWGzT] "MuSeeum is speaking..."
  │   │
  │   ├─ transcriptArea [IQKPr] — Art Info Agent result (candidate)
  │   │   ├─ [thinkLabel: z5z6F] "I think this is..."
  │   │   ├─ [artworkTitle: aieIJ] "The Hay Wain" (28px gold, Times)
  │   │   ├─ [artistName: zvvws] "by John Constable"
  │   │   └─ metaRow [8qMDW]
  │   │       ├─ [yearChip: Onf8R] "1821" (dark chip)
  │   │       ├─ [museumChip] "National Gallery, London" (if available)
  │   │       └─ [periodChip: 4kKlM] "Romanticism" (gold chip)
  │   │
  │   └─ [helperText: NqzJn] "Say 'yes' to confirm, or tell me the correct name"
  │
  └─ micSection [OqoGR] — push-to-talk interaction
      ├─ [micButton: Q7yXT] 🎙 (80px gold circle, glow shadow)
      │   └──▶ push-to-talk → Gemini Live voice session
      │   └──▶ user says "yes" → call confirm endpoint → Docent Agent runs → vE9pj
      │   └──▶ user says "no" / corrects → AI retries or asks for name
      │   └──▶ user provides name by voice → confirm → Docent Agent → vE9pj
      │   └──▶ INTERRUPTIBLE — user can barge in while AI speaks
      ├─ [micLabel: AXDXN] "Tap to speak"
      └─ [typeItLink: 4h5h9] "Or type it myself" (text fallback)
          └──▶ text input for title → confirm → Docent Agent → vE9pj
  │
  └─ Confirmation rule: If user does not respond within 5 seconds, treat as confirmed
      └──▶ call confirm endpoint → Docent Agent generates description → vE9pj (Artwork Analysis)
```

### Flow 4: Artwork Analysis Result

Content on this screen (description, tags, sections) is produced by the **Docent Agent** (museum docent presentation), after art info was confirmed on XLRyj (Live Identification).

```
vE9pj (Artwork Analysis Result)
  │
  ├─ topBar [TZLC8]
  │   ├─ [backButton: sdv92] ←
  │   │   └──▶ Ij4bQ (Museum Gallery Grid) — if museum exists
  │   │   └──▶ k4vP2 (Home with visits) — if navigated from home
  │   │
  │   └─ [likeButton: d43z1] ♥ (filled heart = liked)
  │       └──▶ toggles liked state on this artwork
  │       └──▶ liked artworks show filled heart badge on grid (Ij4bQ)
  │
  ├─ imageSection [599Aa]
  │   ├─ [artworkPhoto: l5Plr] — horizontal slider (3 photo slides)
  │   │   └──▶ swipe left/right to browse photos
  │   │   └──▶ tap photo → 40pgf (Photo Viewer — full screen)
  │   │
  │   ├─ [aiScanBadge: ar9mC] "AI Analyzed" — Docent Agent content
  │   ├─ [photoCountBadge: M89SL] "1/3" — informational
  │   └─ [paginationDots: zy9KF] — reflects current slide
  │
  ├─ contentSection [zXX0m] — Docent Agent output (title, artist, meta, description, tags)
  │   ├─ titleRow [oJ4nz]
  │   │   ├─ [artworkName: hVVyj] "The Hay Wain"
  │   │   └─ [artistName: CwZPR] "John Constable"
  │   │
  │   ├─ metaRow [gyiNp]
  │   │   ├─ [yearChip: sWOiJ] "1821"
  │   │   └─ [museumChip: HXEBb] "National Gallery, London"
  │   │       └──▶ tap → Ij4bQ (Museum Gallery Grid)
  │   │
  │   ├─ periodRow [qDp31]
  │   │   ├─ [label: jsD1I] "Art Period"
  │   │   └─ [periodChip: sDuq3] "Romanticism" (gold pill, palette icon)
  │   │
  │   ├─ tagsSection [ONPnD]
  │   │   ├─ [label: Legf2] "Tags"
  │   │   └─ tagsWrap [Y44oW] (flex-wrap)
  │   │       ├─ [tag: MQ8Ib] "Landscape"
  │   │       ├─ [tag: hyyNO] "Nature"
  │   │       ├─ [tag: y2NPX] "Rural Life"
  │   │       ├─ [tag: Ir3s8] "Oil Painting"
  │   │       └─ [tag: Wpy3S] "Pastoral"
  │   │
  │   └─ descriptionSection [IyOtf] — scrollable text (Docent Agent)
  │
  └─ bottomCTA [LSbMh]
      └─ [talkToAIButton: ZNOMj] "Talk to AI Guide"
          └──▶ opens Gemini Live voice session (not prototyped in design)
```

### Flow 5: Returning User — Home with Visits → Gallery Grid

```
k4vP2 (Home with Visits — Carousel)
  │
  ├─ topBar [gLGBT]
  │   ├─ [city: b5qg9] "Paris" — informational
  │   ├─ [logoWrap: Uv9Y7] — app logo
  │   └─ [avatar: 5vNFF] — profile photo
  │       └──▶ (Profile tab — not prototyped)
  │
  ├─ mainContent [mV2A1] — visit cards carousel
  │   └──▶ tap a visit card → Ij4bQ (Museum Gallery Grid)
  │
  ├─ discoveryMenu [l1C5K]
  │   └─ discoveriesRow [LB5HR]
  │       ├─ [action1: wEz7w] "Explore History" → (not prototyped)
  │       ├─ [action2: VMPF8] "Favorite Artworks" → tTm4I (Favorite Artworks)
  │       └─ [action3: ce7S6] "Collection Stats" → pz0Fs (Collection Stats)
  │
  └─ bottomNav [mV2A41]
      ├─ [tabDiscover] → (Discover)
      ├─ [tabMap] → (Map)
      ├─ [tabVisits] → current screen (active)
      └─ [tabProfile] → (Profile)
```

### Flow 6: Museum Gallery Grid

```
Ij4bQ (Museum Gallery Grid)
  │
  ├─ topBar [5bdpT]
  │   ├─ [backButton: 4cvWy] ←
  │   │   └──▶ k4vP2 (Home with visits)
  │   │
  │   ├─ [screenTitle: 58Fay] "National Gallery"
  │   │
  │   └─ [shareButton: sDA4b] share icon
  │       └──▶ OS share sheet (share museum visit)
  │
  ├─ headerSection [JSpg9]
  │   ├─ headerRow [HFWm4]
  │   │   ├─ [museumName: MjaOp] "National Gallery, London"
  │   │   └─ [editButton: wQzHh] pencil icon
  │   │       └──▶ XFAXz (Edit Museum)
  │   │
  │   └─ metaRow [NYSGq]
  │       ├─ [calIcon: Jagr5] + [visitDate: wv5WP] "Visited Mar 10, 2026"
  │       └─ [imgIcon: C55KC] + [photoCount: v3Mx7] "6 artworks"
  │
  ├─ gridSection [Pu3nT]
  │   ├─ gridRow1 [RGtKp]
  │   │   ├─ [artCard1: WEouY] "The Hay Wain" — has ♥ heart badge (liked)
  │   │   │   └──▶ tap → vE9pj (Artwork Analysis) — if confirmed
  │   │   │   └──▶ tap → XLRyj (Live Identification) — if unconfirmed
  │   │   ├─ [artCard2: klgkj] "Sunflowers" — has ♥ heart badge (liked)
  │   │   │   └──▶ tap → vE9pj or XLRyj (same confirmation logic)
  │   │   └─ [artCard3: V6jrj] "The Fighting Temeraire" — no heart (not liked)
  │   │       └──▶ tap → vE9pj or XLRyj (same confirmation logic)
  │   │
  │   └─ gridRow2 [roC9X]
  │       ├─ [artCard4: iwdwh] "The Ambassadors" — no heart (not liked)
  │       │   └──▶ tap → vE9pj or XLRyj (same confirmation logic)
  │       ├─ [artCard5: 2YaBp] "Bathers at Asnières" — no heart (not liked)
  │       │   └──▶ tap → vE9pj or XLRyj (same confirmation logic)
  │       └─ [artCard6: naNGh] "Rain, Steam and Speed" — has ♥ heart badge (liked)
  │           └──▶ tap → vE9pj or XLRyj (same confirmation logic)
  │
  │   NOTE: Unconfirmed cards show a subtle indicator (e.g. dashed border or
  │   pending badge). Tapping an unconfirmed card goes to XLRyj (Live Identification) first.
  │   If two photos belong to the same artwork, they are merged into one card.
  │
  ├─ [fabButton: wIrdh] camera FAB (gold circle)
  │   └──▶ xEPrW (Photo Menu) or directly open camera
  │       └──▶ after capture → XLRyj (Live Identification — voice confirm)
  │
  └─ bottomNav [v51oI]
      ├─ [tabDiscover: X9tcE] → (Discover — not prototyped)
      ├─ [tabMap: j0OK9] → (Map — not prototyped)
      ├─ [tabVisits: esYQj] → k4vP2 (Home — active tab)
      └─ [tabProfile: HkOyU] → (Profile — not prototyped)
```

### Flow 7: Edit Museum

```
XFAXz (Edit Museum)
  │
  ├─ topBar [CTo03]
  │   ├─ [closeButton: rxxCW] ✕
  │   │   └──▶ dismiss → Ij4bQ (Museum Gallery Grid)
  │   └─ [screenTitle: ENCl9] "Edit Museum"
  │
  └─ content [cmKov]
      ├─ currentSection [N0jOD] — shows current museum with gold border
      │
      ├─ [searchField: AXf1l] — search for a different museum
      │
      └─ changeSection [5n9H7] — list of alternative museums + custom name option
          └──▶ tap a museum → updates museum on Ij4bQ → dismiss back to Ij4bQ
```

### Flow 8: Photo Viewer (Full-Screen)

```
40pgf (Photo Viewer)
  │
  ├─ topBar [gbLxS]
  │   ├─ [closeButton: jKpUd] ✕
  │   │   └──▶ dismiss → vE9pj (Artwork Analysis — back to slider)
  │   │
  │   ├─ titleCol [jUYbA] — artwork name + "Photo X of Y"
  │   │
  │   └─ [shareButton: fwFog] share icon
  │       └──▶ OS share sheet (share this photo)
  │
  ├─ [photoFrame: lUOaj] — large zoomable photo
  │   └──▶ pinch to zoom, swipe left/right for next/prev photo
  │
  ├─ [paginationDots: 87gPU] — dot indicators for photo position
  │
  ├─ infoBar [YA2nc]
  │   ├─ artMeta [5nlo2] — artwork name + artist
  │   └─ captureInfo [ejO0J] — capture date/time
  │
  └─ noteBar [iMRSk]
      ├─ noteLabelRow [90t5v] — "Your Note" + edit button
      │   └──▶ tap edit → editable text field
      └─ noteContent [edtSx] — user's note text
```

### Flow 9: Collection Stats

```
pz0Fs (Collection Stats)
  │
  ├─ topBar [CAmRP]
  │   ├─ [backButton: M0TJd] ←
  │   │   └──▶ k4vP2 (Home with Visits)
  │   ├─ [screenTitle: 3wYAj] "Collection Stats"
  │   └─ [spacer: UVlmh]
  │
  └─ content [eU7dg] — scrollable
      ├─ summaryRow [74VlP] — 3 stat cards
      │   ├─ [statCard1: Qpgct] "3 Museums Visited"
      │   ├─ [statCard2: WWBtN] "18 Artworks Captured"
      │   └─ [statCard3: 4yhz8] "7 Favorites"
      │
      ├─ artworksPerMuseum [msLlj]
      │   ├─ [heading: amfMo] "Artworks per Museum"
      │   └─ barChart [rZUtQ]
      │       ├─ [barRow1: 3rB8U] National Gallery — 8
      │       ├─ [barRow2: w9ULd] Musée d'Orsay — 6
      │       └─ [barRow3: ko7hN] The Louvre — 4
      │
      ├─ artPeriods [xZXc7]
      │   ├─ [heading: UoeFX] "Art Periods"
      │   └─ periodList [CvD4w] — ordered list with count badges
      │       ├─ [periodItem1: Ymeam] 1 Romanticism — 6 (gold badge #B08A1F)
      │       ├─ [periodItem2: 5cle7] 2 Impressionism — 5 (badge #C9A836)
      │       ├─ [periodItem3: S2bFO] 3 Renaissance — 4 (badge #D4B44A)
      │       └─ [periodItem4: UqmsS] 4 Post-Impressionism — 3 (cream badge)
      │
      └─ topArtists [QoXhe]
          ├─ [heading: b6kDE] "Top Artists"
          └─ artistList [PLaCt]
              ├─ [artist1: 4tkXH] #1 John Constable — 4 artworks
              ├─ [artist2: ruPpH] #2 Claude Monet — 3 artworks
              └─ [artist3: jD2BV] #3 J.M.W. Turner — 2 artworks
```

### Flow 10: Favorite Artworks

```
tTm4I (Favorite Artworks)
  │
  ├─ topBar [M9PKJ]
  │   ├─ [backButton: 5CNFb] ←
  │   │   └──▶ k4vP2 (Home with Visits)
  │   ├─ [screenTitle: C9NXj] "Favorite Artworks"
  │   └─ [spacer: odIpo]
  │
  └─ content [Fa1rN] — scrollable grid
      ├─ headerSection [6KTGc]
      │   ├─ [title: b4wGv] "7 Favorite Artworks"
      │   └─ [subtitle: Y028P] "Across 3 museums"
      │
      ├─ gridSection [9zuSt] — 3-column image grid with heart badges
      │   ├─ gridRow1 [VLhx1]
      │   │   ├─ [favCard1: LNMRX] "The Hay Wain" — J. Constable (National Gallery)
      │   │   ├─ [favCard2: A64kM] "Sunflowers" — V. van Gogh (National Gallery)
      │   │   └─ [favCard3: WIBHV] "Water Lilies" — C. Monet (Musée d'Orsay)
      │   │
      │   ├─ gridRow2 [PUHMv]
      │   │   ├─ [favCard4: 841E5] "Rain, Steam and Speed" — J.M.W. Turner (National Gallery)
      │   │   ├─ [favCard5: nbwsF] "Impression, Sunrise" — C. Monet (Musée d'Orsay)
      │   │   └─ [favCard6: iu0ss] "Starry Night Over the Rhône" — V. van Gogh (Musée d'Orsay)
      │   │
      │   └─ gridRow3 [OBaG1]
      │       └─ [favCard7: 0Ogvu] "Liberty Leading the People" — E. Delacroix (The Louvre)
      │
      └──▶ tap any card → vE9pj (Artwork Analysis)
```

---

## Complete User Journey (Happy Path)

```
1. User opens app for first time
   └──▶ Tu4DF (Empty Home)

2. Taps "Start Exploring"
   └──▶ xEPrW (Photo Menu sheet appears)

3. Taps "Take a Photo"
   └──▶ Device camera opens directly (no museum picker)

4. User captures artwork photo
   └──▶ Session created without museum; image sent to backend

5. Art Info Agent analyzes photo (with search/Wiki grounding), discovers museum → Live Identification opens
   └──▶ XLRyj (Live Identification — dark immersive, AI speaks)

5b. AI speaks: "I think this is The Hay Wain by John Constable..." (and museum, date if known)
   └──▶ User taps mic, says "yes" → confirm → Docent Agent generates description → vE9pj (Artwork Analysis)
   └──▶ Or user does not respond within 5 seconds → treat as confirmed → Docent Agent → vE9pj

5c. (Alt) User says "no" / corrects by voice → AI retries
   └──▶ Or taps "Or type it myself" → manual title → confirm → Docent Agent → vE9pj

6. User taps ♥ to like the artwork
   └──▶ heart fills red on d43z1

7. User taps back ←
   └──▶ Ij4bQ (Museum Gallery Grid — first artwork appears)

8. User taps FAB camera to add more artworks
   └──▶ Device camera → XLRyj (voice confirm each) → vE9pj
   └──▶ If photo matches existing artwork → merged into same card

9. User taps an artwork card in the grid
   └──▶ vE9pj (if confirmed) or XLRyj (voice confirm if unconfirmed)

10. User taps the artwork photo
    └──▶ 40pgf (Photo Viewer — zoom & notes)

11. User taps ✕ in Photo Viewer
    └──▶ vE9pj (back to artwork detail)

12. User taps edit ✎ next to museum name
    └──▶ XFAXz (Edit Museum)

13. User selects correct museum
    └──▶ Ij4bQ (updated museum name)

14. User taps share in top bar
    └──▶ OS share sheet

15. Next app open — user sees visits
    └──▶ k4vP2 (Home with carousel of past visits)
```

---

## Front–Back–Agent Communication & Deployment (Google Cloud)

Patterns are aligned with the **Way Back Home** reference (`way-back-home/dashboard/backend`, `way-back-home/dashboard/frontend`, `way-back-home/solutions/level_0`, `way-back-home/solutions/level_1`). Use that repo as the hands-on example for agent building and deployment.

### Communication

| Layer | Responsibility | Talks to |
| ----- | -------------- | -------- |
| **Frontend** | UI, camera/mic, session state, REST + WebSocket client | Backend only (single `NEXT_PUBLIC_API_URL` or equivalent). No direct agent or Gemini URLs. |
| **Backend** | Auth, Drive `index.json`, session/artwork CRUD, **invokes** Art Info + Docent agents, Live WebSocket server | Frontend (REST/WS), Gemini (grounding, Live, text), Google Drive, optional MCP/tool services. |
| **Agents** | Art Info Agent (vision + grounding → candidate); Docent Agent (description after confirm). Run **inside backend** on request. | Backend passes context (sessionId, image, candidate); agents use backend’s Gemini/Drive config. No A2A unless we add separate agent services later. |

**Improvements over ad-hoc wiring:**

1. **Single API gateway:** All client traffic goes to the backend. Frontend never calls Gemini or an agent URL. Backend owns CORS, auth, and rate limits.
2. **Backend as source of truth:** Sessions, artworks, and summaries live in Drive (or backend DB). Agents receive context from the request and backend state (e.g. session, last artwork); no agent-side config files for participant/session data.
3. **Request-scoped agents:** For MuSeeum, Art Info and Docent are invoked per HTTP request (e.g. on `POST /session/:id/artwork` and `POST /session/:id/artwork/confirm`). No long-lived agent process; no `PARTICIPANT_ID`/`BACKEND_URL` in env for agents—backend passes what’s needed in the handler.
4. **Live Agent:** WebSocket `WS /api/live/:sessionId` is served by the backend; backend holds the Gemini Live session and injects artwork context. Same single-origin as REST.

### Deployment (Google Cloud)

| Component | Build | Deploy | Env / config |
| --------- | ----- | ------ | ------------- |
| **Backend** | Dockerfile (Node/TS, install → run server) | Cloud Run (e.g. `museum-guide-api`), port from `PORT` | `GOOGLE_CLOUD_PROJECT`, Drive credentials, Gemini API key or ADC, `API_BASE_URL` (for CORS/callbacks). Optional: Secret Manager for keys. |
| **Frontend** | Dockerfile multi-stage (deps → build → standalone) or static export | Cloud Run (Node server) or Firebase Hosting / Vercel / static host | Build args: `NEXT_PUBLIC_API_URL` (or equivalent). Runtime: same URL for API client. |
| **Agents** | No separate image; run inside backend process | N/A (backend deployment includes agent code) | Use backend env (Gemini, project, Drive). If we later split an agent to its own service: env like Way Back Home (`BACKEND_URL`, `PUBLIC_URL` for A2A). |

**Checklist:**

- Backend: Dockerfile + `cloudbuild.yaml` or GitHub Actions (build image → push to Artifact Registry → deploy to Cloud Run). Health check on `/health` or `/api/health`.
- Frontend: Build with `NEXT_PUBLIC_API_URL` set to backend URL; deploy to chosen host; ensure CORS on backend allows frontend origin.
- Env: Document all required env vars in each repo’s README and `.env.example`; use same names as Way Back Home where they align (`API_BASE_URL`, `GOOGLE_CLOUD_PROJECT`).
- Optional: MCP or tool service (e.g. custom grounding or tools) → separate Cloud Run service and HTTP transport; backend calls it by URL. See Way Back Home `solutions/level_1/mcp-server` and `cloudbuild.yaml` for the pattern.

---

## Design Tokens Reference

| Token        | Value     | Usage                         |
| ------------ | --------- | ----------------------------- |
| Gold Primary | `#B08A1F` | CTA buttons, FAB, active tabs |
| Gold Light   | `#C9A836` | Accent highlights             |
| Gold Dark    | `#8A6B12` | Artist name text              |
| Cream        | `#F9F5EB` | Chips, option backgrounds     |
| Red / Heart  | `#EF4444` | Like heart (filled)           |
| Dark Text    | `#111827` | Primary headings              |
| Gray Text    | `#6B7280` | Secondary / meta text         |
| Light Gray   | `#9CA3AF` | Tertiary text, icons          |
| Background   | `#FFFFFF` | Screen backgrounds            |
| Divider      | `#F3F4F6` | Separator lines               |

**Typography:** Inter (UI), Times New Roman (headings). **Icons:** lucide icon font. **Screen size:** 390×844.
