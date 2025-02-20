import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
interface Shape {
  type: 'rectangle' | 'circle' | 'polygon' | 'polyline';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: { x: number, y: number }[]; 
  strokeColor?: string;
  fillColor?: string;
}
type HandleType = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'circle-handle';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit, AfterViewInit {
  
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D | any;
  private scaleFactor: number = 1.05; // Zoom factor
  private zoomLevel: number = 1; // Initial zoom level
  svgImage = new Image();
  svgUrl = 'assets/room.svg';

  // All drawn shapes
  shapes: Shape[] =[];

  // Selected tool for new shapes
  selectedShape: 'rectangle' | 'circle' | 'polygon' | 'polyline' = 'rectangle';

  // Color selection for stroke and fill.
  selectedStrokeColor: string = '#000000';
  selectedFillColor: string = '#FF0000';

  // Drawing state for rectangle & circle
  isDrawing = false;
  startX = 0;
  startY = 0;
  previewShape: Shape | null = null;

  // Dragging state
  isDragging = false;
  dragIndex: number | null = null;
  dragOffsetX = 0;
  dragOffsetY = 0;

  // Resizing state (for rectangle & circle)
  isResizing = false;
  resizingIndex: number | null = null;
  resizingHandle: HandleType | null = null;
  readonly handleSize = 8;

  // Polygon drawing state
  isPolygonDrawing = false;
  polygonPoints: { x: number, y: number }[] = [];
  polyLinePoints: { x: number, y: number }[] = [];

  private svgImageDrawn = false;

  ngOnInit(): void {
    this.ctx = this.canvas.nativeElement.getContext('2d');
    let data = localStorage.getItem("ShapesData");
    if(data){
      this.shapes = JSON.parse(data);
      this.redraw();
    }
  }
  ngAfterViewInit() {
    // this.ctx = this.canvas.nativeElement.getContext('2d');
    // this.redraw();
    const canvas = this.canvas.nativeElement;

    if (this.ctx && !this.svgImageDrawn) {
      
      this.svgImage.src = this.svgUrl;

      this.svgImage.onload = () => {
        this.ctx.drawImage(this.svgImage, 0, 0);
        this.svgImageDrawn = true;
      };
      this.redraw();
    }
  }

  setShape(shape: 'rectangle' | 'circle' | 'polygon' | 'polyline') {
    debugger;
    this.selectedShape = shape;
    // If switching to polygon mode, start a new polygon
    if (shape === 'polygon') {
      this.isPolygonDrawing = true;
      this.polygonPoints = [];
    } else if(shape === 'polyline'){
      this.isPolygonDrawing = true;
      this.polyLinePoints = [];
    } else {
      this.isPolygonDrawing = false;
      this.polygonPoints = [];
    }
  }

  /** Returns the index of the shape under the given coordinates (for dragging) */
  private getShapeAt(x: number, y: number): number | null {
    // (Implementation remains unchanged for rectangle and circle)
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const shape = this.shapes[i];
      if (shape.type === 'rectangle' && shape.width !== undefined && shape.height !== undefined) {
        if (x >= shape.x! && x <= shape.x! + shape.width &&
            y >= shape.y! && y <= shape.y! + shape.height) {
          return i;
        }
      } else if (shape.type === 'circle' && shape.radius !== undefined) {
        const dx = x - shape.x!;
        const dy = y - shape.y!;
        if (Math.sqrt(dx * dx + dy * dy) <= shape.radius) {
          return i;
        }
      } else if (shape.type === 'polygon' && shape.points) {
        // Simple point-in-polygon check (ray-casting algorithm)
        if (this.isPointInPolygon({ x, y }, shape.points)) {
          return i;
        }
      } else {
        debugger;
      }
    }
    return null;
  }

  // Basic ray-casting algorithm for point-in-polygon.
  private isPointInPolygon(point: { x: number, y: number }, vertices: { x: number, y: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
                        (point.x < (xj - xi) * (point.y - yi) / (yj - yi + 0.00001) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * getResizeHandleAt remains unchanged (only applies for rectangle and circle).
   * For simplicity, we don't support resizing polygons in this example.
   */
  private getResizeHandleAt(x: number, y: number): { index: number, handle: HandleType } | null {
    console.log(this.shapes);
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const shape = this.shapes[i];
      if (shape.type === 'rectangle' && shape.width !== undefined && shape.height !== undefined) {
        const corners: { handle: HandleType, cx: number, cy: number }[] = [
          { handle: 'top-left', cx: shape.x!, cy: shape.y! },
          { handle: 'top-right', cx: shape.x! + shape.width, cy: shape.y! },
          { handle: 'bottom-left', cx: shape.x!, cy: shape.y! + shape.height },
          { handle: 'bottom-right', cx: shape.x! + shape.width, cy: shape.y! + shape.height },
        ];
        for (const corner of corners) {
          if (Math.abs(x - corner.cx) <= this.handleSize && Math.abs(y - corner.cy) <= this.handleSize) {
            return { index: i, handle: corner.handle };
          }
        }
      } else if (shape.type === 'circle' && shape.radius !== undefined) {
        const handleX = shape.x! + shape.radius;
        const handleY = shape.y!;
        if (Math.abs(x - handleX) <= this.handleSize && Math.abs(y - handleY) <= this.handleSize) {
          return { index: i, handle: 'circle-handle' };
        }
      } else if (shape.type === 'polygon' && shape.points) {
        for (let j = 0; j < shape.points.length; j++) {
          const point = shape.points[j];
          if (Math.abs(x - point.x) <= this.handleSize && Math.abs(y - point.y) <= this.handleSize) {
            return { index: i, handle: `polygon-point-${j}` as HandleType }; // Each vertex is a handle
          }
        }
      } else {
        debugger;
      }
    }
    return null;
  }

  onMouseDown(event: MouseEvent) {
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // If polygon tool is active, add a vertex
    if (this.selectedShape === 'polygon' && this.isPolygonDrawing) {
      this.polygonPoints.push({ x: mouseX, y: mouseY });
      this.redraw();
      return;
    } else if(this.selectedShape == 'polyline' && this.isPolygonDrawing){
      this.polyLinePoints.push({ x: mouseX, y: mouseY });
      if (this.polyLinePoints.length === 2) {
        this.redraw();
        this.polyLinePoints = [];
        return;
      }
    }

    // Check for resizing first (applies only to rectangle and circle).
    const resizeHandle = this.getResizeHandleAt(mouseX, mouseY);
    if (resizeHandle) {
      this.isResizing = true;
      this.resizingIndex = resizeHandle.index;
      this.resizingHandle = resizeHandle.handle;
      return;
    }

    // Check for dragging an existing shape.
    const shapeIndex = this.getShapeAt(mouseX, mouseY);
    if (shapeIndex !== null) {
      this.isDragging = true;
      this.dragIndex = shapeIndex;
      this.dragOffsetX = mouseX - this.shapes[shapeIndex].x!;
      this.dragOffsetY = mouseY - this.shapes[shapeIndex].y!;
      return;
    }

    // Otherwise, start drawing a new rectangle or circle.
    this.isDrawing = true;
    this.startX = mouseX;
    this.startY = mouseY;
    this.previewShape = null;
  }

  onMouseMove(event: MouseEvent) {
    if (!this.ctx) return;
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Update cursor style (resizing and dragging logic remains unchanged).
    const resizeCandidate = this.getResizeHandleAt(mouseX, mouseY);
    if (resizeCandidate) {
      this.canvas.nativeElement.style.cursor = 'nwse-resize';
    } else if (this.getShapeAt(mouseX, mouseY) !== null) {
      this.canvas.nativeElement.style.cursor = 'move';
    } else {
      this.canvas.nativeElement.style.cursor = 'crosshair';
    }

    // Handle resizing (for rectangle and circle)
    if (this.isResizing && this.resizingIndex !== null && this.resizingHandle) {
      const shape = this.shapes[this.resizingIndex];
      if (shape.type === 'rectangle' && shape.width !== undefined && shape.height !== undefined) {
        switch (this.resizingHandle) {
          case 'top-left': {
            const newWidth = shape.width + (shape.x! - mouseX);
            const newHeight = shape.height + (shape.y! - mouseY);
            if (newWidth > 0 && newHeight > 0) {
              shape.x = mouseX;
              shape.y = mouseY;
              shape.width = newWidth;
              shape.height = newHeight;
            }
            break;
          }
          case 'top-right': {
            const newWidth = mouseX - shape.x!;
            const newHeight = shape.height + (shape.y! - mouseY);
            if (newWidth > 0 && newHeight > 0) {
              shape.y = mouseY;
              shape.width = newWidth;
              shape.height = newHeight;
            }
            break;
          }
          case 'bottom-left': {
            const newWidth = shape.width + (shape.x! - mouseX);
            const newHeight = mouseY - shape.y!;
            if (newWidth > 0 && newHeight > 0) {
              shape.x = mouseX;
              shape.width = newWidth;
              shape.height = newHeight;
            }
            break;
          }
          case 'bottom-right': {
            const newWidth = mouseX - shape.x!;
            const newHeight = mouseY - shape.y!;
            if (newWidth > 0 && newHeight > 0) {
              shape.width = newWidth;
              shape.height = newHeight;
            }
            break;
          }
        }
      } else if (shape.type === 'circle' && shape.radius !== undefined) {
        const dx = mouseX - shape.x!;
        const dy = mouseY - shape.y!;
        const newRadius = Math.sqrt(dx * dx + dy * dy);
        if (newRadius > 0) {
          shape.radius = newRadius;
        }
      } else {
        debugger;
      }
      this.redraw();
      return;
    }

    // Handle dragging.
    if (this.isDragging && this.dragIndex !== null) {
      const shape = this.shapes[this.dragIndex];
      shape.x = mouseX - this.dragOffsetX;
      shape.y = mouseY - this.dragOffsetY;
      this.redraw();
      return;
    }

    // Handle drawing (for rectangle and circle)
    if (this.isDrawing) {
      const width = mouseX - this.startX;
      const height = mouseY - this.startY;
      if (this.selectedShape === 'rectangle') {
        this.previewShape = {
          type: 'rectangle',
          x: this.startX,
          y: this.startY,
          width,
          height,
          strokeColor: this.selectedStrokeColor,
          fillColor: this.selectedFillColor
        };
      } else if (this.selectedShape === 'circle') {
        const radius = Math.sqrt(width * width + height * height);
        this.previewShape = {
          type: 'circle',
          x: this.startX,
          y: this.startY,
          radius,
          strokeColor: this.selectedStrokeColor,
          fillColor: this.selectedFillColor
        };
      }
      this.redraw();
      return;
    }

    // For polygon drawing, show a preview line from the last vertex to current mouse position.
    if ((this.selectedShape === 'polygon') && this.isPolygonDrawing && this.polygonPoints.length) {
      // Create a temporary preview polygon using existing points plus current mouse position.
      const previewPolygon: Shape = {
        type: 'polygon',
        points: [...this.polygonPoints, { x: mouseX, y: mouseY }],
        strokeColor: this.selectedStrokeColor,
        fillColor: this.selectedFillColor
      };
      this.previewShape = previewPolygon;
      this.redraw();
    }
    else if ((this.selectedShape === 'polyline') && this.isPolygonDrawing && this.polygonPoints.length) {
      // Create a temporary preview polygon using existing points plus current mouse position.
      const previewPolygon: Shape = {
        type: 'polyline',
        points: [...this.polygonPoints, { x: mouseX, y: mouseY }],
        strokeColor: this.selectedStrokeColor,
        fillColor: this.selectedFillColor
      };
      this.previewShape = previewPolygon;
      this.redraw();
    }
  }

  onMouseUp(event: MouseEvent) {
    if (this.isResizing) {
      this.isResizing = false;
      this.resizingIndex = null;
      this.resizingHandle = null;
      return;
    }
    if (this.isDragging) {
      this.isDragging = false;
      this.dragIndex = null;
      return;
    }
    if (this.isDrawing && this.previewShape) {
      debugger;
      if(this.previewShape.type == "rectangle" && this.previewShape.width != 0 && this.previewShape.height != 0){
        this.shapes.push(this.previewShape);
      } else if(this.previewShape.type == 'circle' || this.previewShape.type == "polygon" || this.previewShape.type == "polyline"){
        this.shapes.push(this.previewShape);
      }
      localStorage.setItem("ShapesData", JSON.stringify(this.shapes));
      this.previewShape = null;
      this.isDrawing = false;
      this.redraw();
      return;
    }
    // Note: For polygons, we don't finish on mouseup.
  }

  // Finish the polygon drawing (triggered by double-click)
  onDoubleClick(event:MouseEvent) {
    console.log('Double click detected');
    if (this.selectedShape === 'polygon' && this.isPolygonDrawing && this.polygonPoints.length >= 3) {
      const polygonShape: Shape = {
        type: 'polygon',
        points: [...this.polygonPoints],
        strokeColor: this.selectedStrokeColor,
        fillColor: this.selectedFillColor
      };
      this.shapes.push(polygonShape);
      localStorage.setItem("ShapesData", JSON.stringify(this.shapes));
      this.isPolygonDrawing = false;
      this.polygonPoints = [];
      this.previewShape = null;
      this.redraw();
    }
    if (this.selectedShape === 'polyline' && this.isPolygonDrawing && this.polygonPoints.length == 2) {
      this.shapes.push({
        type: 'polyline',
        points: [...this.polygonPoints],
        strokeColor: this.selectedStrokeColor
      });
      localStorage.setItem("ShapesData", JSON.stringify(this.shapes));
      this.isPolygonDrawing = false;
      this.polygonPoints = [];
      this.redraw();
    }
  }
  

  clearCanvas() {
    if (!this.ctx) return;
    this.shapes = [];
    this.previewShape = null;
    this.polygonPoints = [];
    this.isPolygonDrawing = false;
    this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    localStorage.setItem("ShapesData", JSON.stringify(this.shapes));
  }

  /** Redraw all shapes (and preview if available) */
  private redraw() {
    if (!this.ctx) return;
    // Clear the canvas.
    this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    
    if (this.svgImageDrawn) {
      this.ctx.drawImage(this.svgImage, 0, 0);
    }
    // Draw each shape.
    for (const shape of this.shapes) {
      this.drawShape(shape);
    }
    // Draw the preview shape if one exists.
    if (this.previewShape) {
      this.drawShape(this.previewShape);
    }
  }

  /** Helper method to draw a shape and, if applicable, its resize handles */
  private drawShape(shape: Shape) {
    if (!this.ctx) return;
    this.ctx.beginPath();
    debugger;
    if (shape.type === 'rectangle' && shape.width !== undefined && shape.height !== undefined) {
      this.ctx.fillStyle = shape.fillColor || '#FFFFFF';
      this.ctx.strokeStyle = shape.strokeColor || '#000000';
      this.ctx.fillRect(shape.x!, shape.y!, shape.width, shape.height);
      this.ctx.strokeRect(shape.x!, shape.y!, shape.width, shape.height);
      // Draw resize handles.
      this.drawHandle(shape.x!, shape.y!);
      this.drawHandle(shape.x! + shape.width, shape.y!);
      this.drawHandle(shape.x!, shape.y! + shape.height);
      this.drawHandle(shape.x! + shape.width, shape.y! + shape.height);
    } else if (shape.type === 'circle' && shape.radius !== undefined) {
      this.ctx.fillStyle = shape.fillColor || '#FFFFFF';
      this.ctx.strokeStyle = shape.strokeColor || '#000000';
      this.ctx.arc(shape.x!, shape.y!, shape.radius, 0, 2 * Math.PI);
      this.ctx.fill();
      this.ctx.stroke();
      // Draw a resize handle.
      this.drawHandle(shape.x! + shape.radius, shape.y!);
    } else if ((shape.type === 'polygon' || shape.type=='polyline') && shape.points) {
      this.ctx.fillStyle = shape.fillColor || '#FFFFFF';
      this.ctx.strokeStyle = shape.strokeColor || '#000000';
      // Draw the polygon by connecting its vertices.
      this.ctx.moveTo(shape.points[0].x, shape.points[0].y);
      for (let i = 1; i < shape.points.length; i++) {
        this.ctx.lineTo(shape.points[i].x, shape.points[i].y);
      }
      // Close the polygon path.
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      // (Optionally, draw small circles at vertices as handles)
      for (const point of shape.points) {
        this.drawHandle(point.x, point.y);
      }
    } else {
      debugger;
    }
  }

  /** Helper method to draw a small square handle at a given position */
  private drawHandle(x: number, y: number) {
    if (!this.ctx) return;
    const size = this.handleSize;
    this.ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
    this.ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
  zoomIn() {
    if (this.ctx) {
      this.zoomLevel *= this.scaleFactor;
      this.applyZoom();
    }
  }

  zoomOut() {
    if (this.ctx) {
      this.zoomLevel /= this.scaleFactor;
      this.applyZoom();
    }
  }

  private applyZoom() {
    if (this.ctx) {
      const canvasElement = this.canvas.nativeElement;
      const { width, height } = canvasElement;

      // Clear the canvas before scaling
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, width, height);

      // Apply new scale
      this.ctx.setTransform(this.zoomLevel, 0, 0, this.zoomLevel, 0, 0);
      this.redraw();
    }
  }
  
}
