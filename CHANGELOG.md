# Changelog

## [0.2.0](https://github.com/slavkozivancevic/marketplace/compare/v0.1.0...v0.2.0) (2026-08-22)


### Features

* **audit:** add date-range filter and reset list scroll on filter change ([5452232](https://github.com/slavkozivancevic/marketplace/commit/5452232daa65e0b2063c707765e6e7326948753e))
* **brand:** MarketVerse rebrand - logo, cosmos palette, Geist, Stripe assets ([cdf4e90](https://github.com/slavkozivancevic/marketplace/commit/cdf4e905ef15bcf8be67745164cb07242b57425f))
* **brand:** theme-aware mark/wordmark, header star strips, invoice brand band ([c2e5f83](https://github.com/slavkozivancevic/marketplace/commit/c2e5f83e40f606a33de7ddb85ccb9d932666ddd6))
* **cart:** quantity stepper on add-to-cart + per-customer coupon limits ([323b00f](https://github.com/slavkozivancevic/marketplace/commit/323b00f494149a01632295dc3660736a5d96519c))
* **infra:** map marketverseapp.com custom domain to staging stage ([d2f1950](https://github.com/slavkozivancevic/marketplace/commit/d2f1950b3b22d45a0481bd9dce1fd8091c190b2d))
* **infra:** wire marketverseapp.com domain + lock CORS to it on staging ([06c8aad](https://github.com/slavkozivancevic/marketplace/commit/06c8aad7143bd8b1d28e1a2afd1c8586365fbda0))
* **mobile,ui:** pull-to-refresh gesture on touch widths, grab cursor on swipeable toasts ([dc6502c](https://github.com/slavkozivancevic/marketplace/commit/dc6502ce076acd395714b0253c33563e2654aa68))
* **payments:** net COD commission debt against Stripe payouts + admin settlement UI ([1fa372c](https://github.com/slavkozivancevic/marketplace/commit/1fa372cab1eb500a8588b970037851a4585e7696))
* **products,tags:** add tag system + bestseller badge ([bffb8cc](https://github.com/slavkozivancevic/marketplace/commit/bffb8ccc05b8a7b2674f12d5e10c3f89ab4dce9d))


### Bug Fixes

* admin form UX polish + mobile viewport fixes ([d1354e3](https://github.com/slavkozivancevic/marketplace/commit/d1354e380107b0d4d95b8290527c0d6bb7f554e3))
* admin i18n/duplicate flow, locale-switch overlay, image shimmers + assorted UI polish ([0e12205](https://github.com/slavkozivancevic/marketplace/commit/0e122056ccb5803534fde25b39a9bc3c493d4ab7))
* **admin,i18n,ui:** unsaved-changes and slug handling, blank-translation fallback, destructive button contrast ([9b6b273](https://github.com/slavkozivancevic/marketplace/commit/9b6b2734ef7224c920d607fcc14d5b1315c6bcbd))
* **admin,ui:** image fallback placeholder, responsive tables, dropdown-based condition menu ([359db68](https://github.com/slavkozivancevic/marketplace/commit/359db68843c3463555bc57747ab54a88791bd1c4))
* **admin:** currency-aware price hints, split history date/time, responsive action rows ([63c6cfb](https://github.com/slavkozivancevic/marketplace/commit/63c6cfb19dc1f11fa1d36cae45e289fb78bd515e))
* **admin:** remove back arrow icon from bulk products header ([f8c1d87](https://github.com/slavkozivancevic/marketplace/commit/f8c1d87e1917d29106609edd4900328c3458e257))
* **filters:** independent sidebar scroll, animate pills, reset list scroll on filter change ([401b5f8](https://github.com/slavkozivancevic/marketplace/commit/401b5f87e0b4388681d79769311f5e7ef1d9cb36))
* **filters:** responsive toolbar layout on narrow screens ([2a9fb14](https://github.com/slavkozivancevic/marketplace/commit/2a9fb14b0b1857bae9d3eab1bcc9dbc0e4edf987))
* **home,header,product:** dismissable menus, instant zoom lens, no sign-up CTA when signed in ([75d095d](https://github.com/slavkozivancevic/marketplace/commit/75d095d779077bcde894e4684e88b445effe4036))
* **images:** retry cold image fetches + finish carousel loop/mobile-header pass ([fdb0376](https://github.com/slavkozivancevic/marketplace/commit/fdb03768bcb0c0cc8455ed08b4e9b01e18ee7eea))
* **infra:** stop sst shell from silently skipping/misrouting migrations ([8357422](https://github.com/slavkozivancevic/marketplace/commit/83574222f0fdcabc3a2b6e0358617acf073dfd6c))
* keep orgs running through Clerk account deletion + close Stripe refund gaps ([3768a05](https://github.com/slavkozivancevic/marketplace/commit/3768a0569e1d296e43ec7b1a34a4b020c77a01d7))
* **layout,mobile:** remove full-bleed header overshoot that let the page scroll into a blank void ([b3dbfe7](https://github.com/slavkozivancevic/marketplace/commit/b3dbfe769f77f26df343410a4e3530d09bc24e0d))
* **layout,ui:** anchor page backdrop to the app shell, align skeletons with their real tables ([f861f13](https://github.com/slavkozivancevic/marketplace/commit/f861f135fed123b3eebc433e012cc1491ce837d9))
* **layout:** consistent header icon sizing, always-visible avatar, no duplicate mobile avatar ([e5d9361](https://github.com/slavkozivancevic/marketplace/commit/e5d936110692b0d781732e929bed9bff53e84803))
* **layout:** remove full-bleed header overshoot that let the page scroll into a blank void ([84ab6f9](https://github.com/slavkozivancevic/marketplace/commit/84ab6f921a552198bdd531664235c158cd8cad9b))
* **mobile:** touch-driven image cycling and layout polish ([984c237](https://github.com/slavkozivancevic/marketplace/commit/984c237da51bad75ca9305279825341a80ac9a8b))
* **product:** row-based touch focus cycling, double-tap zoom fix, nested-anchor buttons ([2330484](https://github.com/slavkozivancevic/marketplace/commit/23304841646976584657c17da434f90cd693fc0a))
* **products,audit:** block self-messaging on own products, improve audit log readability ([00d4879](https://github.com/slavkozivancevic/marketplace/commit/00d48795ad2751e6fe8be6526a9bd21f5dfc22a0))
* **products,chat,auth:** created-by filter, seller-message routing, prefetch crash fix ([169e5f8](https://github.com/slavkozivancevic/marketplace/commit/169e5f8c0736099d0b36a40e31ab1ad6c50a130e))
* **products:** instant filter checkboxes, kill facet flash, fix pill spacing ([69940dc](https://github.com/slavkozivancevic/marketplace/commit/69940dc9dabd7baa1fe7024fd24639861c0174e3))
* **products:** revalidate history cache on bulk status/price updates ([64ec1fe](https://github.com/slavkozivancevic/marketplace/commit/64ec1feaf045074581e47ecb4f6bd671f8c7d377))
* **products:** stop premature S3 delete on media discard, fix dirty-section flag ([851eb16](https://github.com/slavkozivancevic/marketplace/commit/851eb163d24ade90200a85304f482437560d444a))
* **test:** repair stale next/cache stub and next-intl server resolution in integration config ([8f3857e](https://github.com/slavkozivancevic/marketplace/commit/8f3857ec980a38c2a8c042542e8af66f64ebf8f6))
* **theme:** suppress transitions during theme swap to kill color flash ([a9ea6bb](https://github.com/slavkozivancevic/marketplace/commit/a9ea6bb48f4d511691073c09bce6164fc7f89cbe))
* **touch:** gate button hover behind pointer-fine, add double-tap image zoom ([3155cf4](https://github.com/slavkozivancevic/marketplace/commit/3155cf479a7efaff5bb44baf4be6c139902c1e58))
* **ui,admin,loading:** visible skeletons, co-located table placeholders, loading.tsx for every list route ([88990d9](https://github.com/slavkozivancevic/marketplace/commit/88990d98abcb890f1447c0048e5d6f0faf24ca8a))
* **ui:** default Select to popper positioning, add required-field asterisk convention ([86eaf0a](https://github.com/slavkozivancevic/marketplace/commit/86eaf0adc476999bcf3af81f20036cd445d43102))
* **ui:** row-link navigation, collapsible payouts panel, pixel-matched loading skeletons ([204348f](https://github.com/slavkozivancevic/marketplace/commit/204348fa5ce1e1d0a7e4ac87d7744dbcb014b229))


### Build & Maintenance

* **ci:** pin release-please bootstrap-sha to stop full-history scans ([c7a974a](https://github.com/slavkozivancevic/marketplace/commit/c7a974ae884073c73656a3a4f3c4761023aecb64))
* enforce conventional PR titles, surface app version in footer ([6e95717](https://github.com/slavkozivancevic/marketplace/commit/6e95717854f486ce3f6fd8e7b7934c1fbf8cf1a7))
* **readme:** add Deployment & CI/CD (AWS) section for the storefront ([32354ee](https://github.com/slavkozivancevic/marketplace/commit/32354ee31d8db0c4f2ed62617a59b1ed05ee9648))
* remove unused Next.js starter SVG assets ([fba293e](https://github.com/slavkozivancevic/marketplace/commit/fba293e6d790416d33f827679ba257de50133b98))
* switch release versioning to plain semver ([#2](https://github.com/slavkozivancevic/marketplace/issues/2)) ([0518294](https://github.com/slavkozivancevic/marketplace/commit/0518294f4245d59e3354e42b0adb3c2bdb07a39b))
* wire PR title lint + Playwright e2e into CI ([489b19e](https://github.com/slavkozivancevic/marketplace/commit/489b19e5722c9d49e614947eaa49309beb3ab663))
