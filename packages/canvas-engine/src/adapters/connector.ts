import { boundsFromPoints, distanceToSegment } from '../geometry';
import type { NodeAdapter } from '../contracts';
import type { BoardDoc, ConnectorNode } from '../model';
import { getConnectorPathMode, getConnectorWaypointHandles, resolveConnectorCurveBezierControls, resolveConnectorPathPoints } from '../anchors';
import type { AssetRecordLike, CanvasRenderRuntime } from '../runtime';
import { worldToScreen } from '../transform';

export const connectorNodeAdapter: NodeAdapter<ConnectorNode, BoardDoc, CanvasRenderRuntime<AssetRecordLike>> = {
  type: 'connector',
  draw(ctx, node, env) {
    const points = resolveConnectorPathPoints(node, env.board);
    if (!points) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = node.stroke;
    ctx.lineWidth = Math.max(node.width * env.board.viewport.scale, 1.5);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const screenPoints = points.map((point) => worldToScreen(point, env.board.viewport));
    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    if (getConnectorPathMode(node) === 'curve') {
      const controls = resolveConnectorCurveBezierControls(node, env.board);
      if (controls) {
        const control1 = worldToScreen(controls.control1, env.board.viewport);
        const control2 = worldToScreen(controls.control2, env.board.viewport);
        const end = screenPoints[screenPoints.length - 1];
        ctx.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, end.x, end.y);
      } else {
        for (const point of screenPoints.slice(1)) {
          ctx.lineTo(point.x, point.y);
        }
      }
    } else {
      for (const point of screenPoints.slice(1)) {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.stroke();
    ctx.restore();
  },
  getBounds(node, board) {
    const points = board ? resolveConnectorPathPoints(node, board) : null;
    if (!points) {
      return { x: 0, y: 0, w: 0, h: 0 };
    }

    return boundsFromPoints(points);
  },
  hitTest(node, point, tolerance, board) {
    const points = board ? resolveConnectorPathPoints(node, board) : null;
    if (!points) {
      return false;
    }

    for (let index = 0; index < points.length - 1; index += 1) {
      if (distanceToSegment(point, points[index], points[index + 1]) <= tolerance + node.width / 2) {
        return true;
      }
    }

    return false;
  },
  translate(node, delta) {
    return {
      ...node,
      waypoints: getConnectorWaypointHandles(node).map((point) => ({
        x: point.x + delta.x,
        y: point.y + delta.y,
      })),
      curveControl: node.curveControl
        ? {
            x: node.curveControl.x + delta.x,
            y: node.curveControl.y + delta.y,
          }
        : undefined,
      curveStartControl: node.curveStartControl
        ? {
            x: node.curveStartControl.x + delta.x,
            y: node.curveStartControl.y + delta.y,
          }
        : undefined,
      curveEndControl: node.curveEndControl
        ? {
            x: node.curveEndControl.x + delta.x,
            y: node.curveEndControl.y + delta.y,
          }
        : undefined,
      start:
        node.start.kind === 'free'
          ? {
              ...node.start,
              x: node.start.x + delta.x,
              y: node.start.y + delta.y,
            }
          : node.start,
      end:
        node.end.kind === 'free'
          ? {
              ...node.end,
              x: node.end.x + delta.x,
              y: node.end.y + delta.y,
            }
          : node.end,
    };
  },
};
