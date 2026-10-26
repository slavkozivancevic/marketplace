"use client";

import { useLayoutEffect, useRef } from "react";

export const MARK = "data-hydration-mark";
export const DONE = "data-hydrated";

/**
 * A hidden marker inside the streamed app that records when its part of the
 * tree has hydrated - see `HistoryHydrationGate`. One sits in `InnerProviders`
 * and one in each layout header: the header hydrates in a boundary of its own,
 * several hundred milliseconds after the providers around it.
 *
 * The attribute is set on the DOM node, not rendered: it must not exist in the
 * server HTML, and a state flip would re-render the tree it sits in for
 * nothing.
 */
export function HydrationMark() {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    ref.current?.setAttribute(DONE, "");
  }, []);
  return <span ref={ref} hidden {...{ [MARK]: "" }} />;
}

/*
 * Plain ES5, run by the HTML parser. The gate holds while no marker exists yet
 * (the boundary's HTML has not even streamed in) or any marker has not
 * hydrated; a popstate that leaves the document's path alone (a hash change)
 * has nothing to render and passes through.
 */
export const GATE_SCRIPT = `(function(){var loadedAt=location.pathname+location.search;addEventListener("popstate",function(e){var m=document.querySelectorAll("[${MARK}]");var done=m.length>0;for(var i=0;i<m.length;i++){if(!m[i].hasAttribute("${DONE}")){done=false;break}}if(done||location.pathname+location.search===loadedAt)return;e.stopImmediatePropagation();location.reload()},true)})();`;

/**
 * Turns a Back or Forward that arrives while the app is still hydrating into a
 * full page load of the address the browser has just moved to.
 *
 * The whole app below the locale layout streams in one Suspense boundary, and
 * the header hydrates in yet another, so the router is live well before the
 * header and the page are (about 0.35s against 1-2.7s in dev). A history
 * traversal in that gap reaches Next's `popstate` handler, which
 * soft-navigates; React then hydrates the server's HTML for the OLD page with
 * the router state of the NEW one. The first difference it meets (the header's
 * "you are here" markers, then the page segment itself) throws a hydration
 * error and the tree is re-created on the client. Making those parts agree is
 * not possible - they are different pages - so the traversal simply loads,
 * which is what a browser does without a client router. Next makes the same
 * call for history entries it did not create.
 *
 * Only what both pages share needs a marker: the providers and the layout
 * chrome. A page's own content often hydrates later still (300-500ms after
 * the header on the dashboard), but a traversal swaps that segment for the
 * other page's instead of hydrating it with someone else's state - measured,
 * a Back in that gap soft-navigates without an error.
 *
 * An inline script rather than an effect: even the root layout's own effects
 * run after the router is live (measured: ~1.1s against ~0.35s), and the
 * listener has to be in place before the first Back can arrive. Capture phase
 * on `window`, so at the target it runs before Next's bubbling listener, and
 * `stopImmediatePropagation` keeps that one from starting the soft navigation.
 * Same `dangerouslySetInnerHTML` wrapper as `FoucScript`: the parser runs it
 * once on first load, and React never sees a `<script>` element.
 */
export function HistoryHydrationGate() {
  return (
    <div
      hidden
      style={{ display: "none" }}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: `<script>${GATE_SCRIPT}</script>` }}
    />
  );
}
