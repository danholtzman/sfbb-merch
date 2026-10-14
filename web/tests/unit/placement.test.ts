import { expect, it } from "vitest";
import { DEFAULT_PLACEMENT, placementTransform, canvasPoint, nudge, movePlacement, resizePlacement, centerPlacement, resetPlacement, resolvePlacement } from "../../src/features/artwork/composite";
it("uses the exact 320×310/80×136 transform, including rotation and PNG padding box", () => {
 expect(placementTransform(DEFAULT_PLACEMENT)).toBe("translate(160 147.87) rotate(0) scale(1) translate(-160 -148)");
 expect(placementTransform({ x:25,y:50,width:50,rotation:90 })).toBe("translate(80 155) rotate(90) scale(2) translate(-160 -148)");
});
it("maps CSS-scaled and letterboxed SVG viewports to normalized canvas coordinates", () => {
 expect(canvasPoint({left:10,top:20,width:640,height:620},330,330)).toEqual({x:160,y:155});
 expect(canvasPoint({left:0,top:0,width:640,height:800},320,400)).toEqual({x:160,y:155});
 expect(canvasPoint({left:0,top:0,width:800,height:620},80,0)).toEqual({x:0,y:0});
});
it("nudges by 0.2 or Shift 1 and clamps each edge without rounding drift", () => {
 expect(nudge(DEFAULT_PLACEMENT,"ArrowRight",false)).toEqual({x:50.2,y:47.7,width:25,rotation:0});
 expect(nudge(DEFAULT_PLACEMENT,"ArrowUp",true)).toEqual({x:50,y:46.7,width:25,rotation:0});
 expect(nudge({x:0,y:100,width:25,rotation:0},"ArrowLeft",true).x).toBe(0);
 expect(nudge({x:0,y:100,width:25,rotation:0},"ArrowDown",false).y).toBe(100);
 expect(nudge(DEFAULT_PLACEMENT,"Enter",false)).toEqual(DEFAULT_PLACEMENT);
});
it("moves using normalized canvas delta, and proportionally resizes about the fixed center at any rotation", () => {
 const base={x:50,y:50,width:25,rotation:90};
 expect(movePlacement(base,{x:160,y:155},{x:192,y:186})).toEqual({x:60,y:60,width:25,rotation:90});
 expect(movePlacement(base,{x:160,y:155},{x:1000,y:-500})).toEqual({x:100,y:0,width:25,rotation:90});
 expect(resizePlacement(base,{x:200,y:223},{x:240,y:291})).toEqual({x:50,y:50,width:50,rotation:90});
 expect(resizePlacement(base,{x:200,y:223},{x:160,y:155}).width).toBe(5);
 expect(resizePlacement(base,{x:200,y:223},{x:960,y:1515}).width).toBe(90);
 expect(resizePlacement(base,{x:160,y:155},{x:240,y:291})).toEqual(base);
});
it("centers only horizontal position, resets independently, and retains shared/color precedence", () => {
 expect(centerPlacement({x:12,y:20,width:30,rotation:-45})).toEqual({x:50,y:20,width:30,rotation:-45});
 const reset=resetPlacement(); expect(reset).toEqual({x:50,y:47.7,width:25,rotation:0}); reset.x=1; expect(DEFAULT_PLACEMENT.x).toBe(50);
 expect(resolvePlacement({x:20,y:20,width:20,rotation:20},{x:30,y:30,width:30,rotation:30})).toEqual({x:30,y:30,width:30,rotation:30});
});
