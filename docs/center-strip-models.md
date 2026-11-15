# Center Strip landmark models

These are independent Three.js building groups from OpenStreetMap outlines and hand-built exterior details. The map still uses Google raster for the ground. Apple Maps screenshots and exterior photography informed proportions, facade colors, and placement of distinctive details; neither basemap is embedded in the models.

| Area | Modelling basis |
|---|---|
| ARIA | [Pelli Clarke & Partners](https://pcparch.com/work/aria-resort-and-casino): opposing curved wings and the steel/glass envelope. Mapped lower wings, roof rims and a stylized arrival canopy. |
| Vdara | [Rafael Viñoly Architects](https://www.vinoly.com/works/vdara-hotel-spa-at-citycenter/): three offset, horizontally striped crescents. The height changes and curved rings are from the footprint snapshot. |
| Veer and Crystals | [MGM's Veer reference](https://investors.mgmresorts.com/2010-7-20-Veer-Towers-Unveiled-at-CityCenter) for the five-degree lean, and [Studio Libeskind](https://libeskind.com/work/crystals-at-citycenter/) for the mall's folded roof. Individual roof folds are approximations. |
| The Cosmopolitan | [Arquitectonica](https://arquitectonica.com/architecture/project/cosmopolitan/): both hotel towers above a shared podium. Recognizable silhouette, stepped glazing, ledges and balcony rail geometry; balcony spacing is estimated. |
| Planet Hollywood and Flamingo | [Caesars exterior gallery](https://newsroom.caesars.com/Property-Fact-Sheets/Flamingo-Las-Vegas/), [Caesars property gallery](https://newsroom.caesars.com/media-resources/property-fact-sheets/default.aspx) and the supplied Apple Maps view. Mapped tower wings, roof wells, and facade treatments. The original street marquees remain in the map. |
| Venetian and Palazzo | [The resort's aerial reference](https://www.venetianlasvegas.com/media/press-kit/photos.html). The Venetian, Venezia, and Palazzo towers keep their distinct footprints, stone piers and cornices. The city retains the original Campanile and canal-side dressing. |
| Hard Rock / former Mirage | The supplied Apple Maps view for the retained tower's Y plan, legacy bronze bands, stone crown and glass atrium. This is an illustrative heritage facade, not the final Hard Rock recladding. The existing guitar model and cranes remain on the Strip-facing side; the [Clark County plans](https://clark.legistar.com/View.ashx?GUID=13691ECB-D8CF-4783-97F6-D496E81FFD7D&ID=14205876&M=F) place the guitar on the former volcano site. Older Google raster tiles can still show the historic water outline. |

## Reuse a building

Open **Places → Landmark Studio**, select an entry, and choose **Download .glb**. The file contains the selected meshes, textures for lettering and representative facades, and standard glTF materials. Mesh coordinates use metres with Y up and are centered on the site. The root's glTF extras record its longitude/latitude anchor and footprint attribution.

The map's live window lighting, light spills, crane animation, and satellite or road tiles are not part of the GLB. The studio uses the same tower builders with an optional standalone podium where available. Map podiums keep their opening and road clearance logic; the standalone podiums are simplified outlines. Surrounding roads, neighbors, and separate scene props are not exported as part of a hotel.

For JavaScript reuse, the shared build functions live in `world/citycenter.js` and `world/mid-strip-resorts.js`, with entries in `world/landmark-models.js`. Add an entry for each independently inspectable building or property. Use a fresh group per call and keep footprint claims off in standalone mode.

## Check the map view

**Street-level Strip skyline** uses the same low perspective as a follow camera. The city layer extends its depth while preserving the basemap's x/y projection and near plane. At steep camera angles a separate ground pass blends the edge of the raster before the city draws. The skyline renders before junction detail, bridges, foliage and signal hardware are ready.

When doing another landmark pass, use [the rebuild playbook](landmark-rebuild-playbook.md): compare at the same camera in daylight and at night, preserve mapped roads and neighboring props, and check both the live map and the standalone model. The legacy tower decorators and podium palette changes in `landmarks/vendor/` must be carried forward if the city is reimported.
