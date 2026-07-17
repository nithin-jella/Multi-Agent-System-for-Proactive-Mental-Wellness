"use client";

import { memo } from "react";
import dynamic from "next/dynamic";
import type { MapContainerProps } from "react-leaflet";

const MapContainer = dynamic(async () => (await import("react-leaflet")).MapContainer, { ssr: false });
const TileLayer = dynamic(async () => (await import("react-leaflet")).TileLayer, { ssr: false });
const Polygon = dynamic(async () => (await import("react-leaflet")).Polygon, { ssr: false });
const CircleMarker = dynamic(async () => (await import("react-leaflet")).CircleMarker, { ssr: false });
const Popup = dynamic(async () => (await import("react-leaflet")).Popup, { ssr: false });
const Tooltip = dynamic(async () => (await import("react-leaflet")).Tooltip, { ssr: false });
const ZoomControl = dynamic(async () => (await import("react-leaflet")).ZoomControl, { ssr: false });

import type { CircleMarker as LeafletCircleMarker } from "leaflet";
import { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

export interface FacultyArea {
  id: string;
  name: string;
  description: string;
  color: string;
  fillOpacity?: number;
  coordinates: LatLngExpression[];
}

interface CareQuestLeafletMapProps {
  campusCenter: LatLngExpression;
  campusBounds: LatLngBoundsExpression;
  minZoom?: number;
  maxZoom?: number;
  facultyAreas: FacultyArea[];
  nodes?: CareQuestNodeMarker[];
  className?: string;
  mapProps?: Partial<MapContainerProps>;
  onAreaSelect?: (area: FacultyArea) => void;
}

function CareQuestLeafletMapComponent({
  campusCenter,
  campusBounds,
  minZoom = 16,
  maxZoom = 18,
  facultyAreas,
  nodes = [],
  className,
  mapProps,
  onAreaSelect,
}: CareQuestLeafletMapProps) {
  return (
    <MapContainer
      center={campusCenter}
      zoom={minZoom}
      minZoom={minZoom}
      maxZoom={maxZoom}
      style={{ height: "100%", width: "100%" }}
      maxBounds={campusBounds}
      maxBoundsViscosity={0.85}
      zoomControl={false}
      doubleClickZoom
      scrollWheelZoom
      wheelDebounceTime={120}
      wheelPxPerZoomLevel={80}
      dragging
      className={className}
      {...mapProps}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />
      {facultyAreas.map((area) => (
        <Polygon
          key={area.id}
          positions={area.coordinates}
          pathOptions={{
            color: area.color,
            weight: 2,
            opacity: 0.9,
            fillOpacity: area.fillOpacity ?? 0.25,
            dashArray: "8 6",
          }}
          eventHandlers={{
            click: () => onAreaSelect?.(area),
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={0.9} permanent className="bg-[#021230]/90 text-white">
            <div className="space-y-1">
              <p className="text-xs font-semibold">{area.name}</p>
              <p className="max-w-[160px] text-[10px] leading-snug text-white/80">{area.description}</p>
            </div>
          </Tooltip>
        </Polygon>
      ))}
      {nodes.map((node) => (
        <CircleMarker
          key={node.id}
          center={node.position}
          radius={node.isActive ? 12 : 8}
          pathOptions={{
            color: node.isActive ? "#FFCA40" : node.color ?? "#ffffff",
            weight: node.isActive ? 3 : 2,
            fillColor: node.fillColor ?? "rgba(255, 202, 64, 0.35)",
            fillOpacity: node.isActive ? 0.6 : 0.35,
          }}
          eventHandlers={{
            click: () => node.onSelect?.(node.id),
            mouseover: (event) => {
              const marker = event.target as LeafletCircleMarker;
              marker.setStyle({ weight: node.isActive ? 3.5 : 3 });
              marker.setRadius(node.isActive ? 13 : 9);
            },
            mouseout: (event) => {
              const marker = event.target as LeafletCircleMarker;
              marker.setStyle({ weight: node.isActive ? 3 : 2 });
              marker.setRadius(node.isActive ? 12 : 8);
            },
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -12]}
            opacity={0.95}
            sticky
            className="rounded-2xl border border-white/10 bg-[#021230]/95 px-3 py-2 text-[11px] text-white shadow-[0_12px_28px_rgba(3,16,45,0.45)]"
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white">{node.name}</p>
              {node.zone ? <p className="text-[10px] uppercase tracking-wide text-white/60">{node.zone}</p> : null}
              {node.statusLabel || node.gloomLevel !== undefined ? (
                <p className="flex items-center gap-2 text-[10px] text-white/70">
                  {node.statusLabel ? <span>{node.statusLabel}</span> : null}
                  {node.gloomLevel !== undefined ? (
                    <span className="rounded-full bg-[#FFCA40]/10 px-2 py-0.5 text-[#FFCA40]">Gloom {node.gloomLevel}%</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </Tooltip>
          <Popup className="rounded-3xl border border-[#00153a]/10 shadow-[0_18px_32px_rgba(3,16,45,0.45)]">
            <div className="space-y-2 text-left">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[#0b2b68]/60">
                  {node.zone ?? "CareQuest Node"}
                </p>
                <p className="text-sm font-semibold text-[#001d58]">{node.name}</p>
              </div>
              {node.statusLabel || node.gloomLevel !== undefined ? (
                <p className="flex items-center gap-2 text-xs font-medium text-[#0a2a6e]">
                  {node.statusLabel ? <span>{node.statusLabel}</span> : null}
                  {node.gloomLevel !== undefined ? (
                    <span className="rounded-full bg-[#FFCA40]/15 px-2 py-0.5 text-[#ad7a0c]">
                      Gloom {node.gloomLevel}%
                    </span>
                  ) : null}
                </p>
              ) : null}
              {node.description ? (
                <p className="max-w-[220px] text-xs leading-snug text-[#0a2a6e]/90">{node.description}</p>
              ) : null}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

export const CareQuestLeafletMap = memo(CareQuestLeafletMapComponent);

export default CareQuestLeafletMap;

export interface CareQuestNodeMarker {
  id: string;
  name: string;
  description?: string;
  status?: string;
  statusLabel?: string;
  zone?: string;
  gloomLevel?: number;
  color?: string;
  fillColor?: string;
  position: LatLngExpression;
  isActive?: boolean;
  onSelect?: (id: string) => void;
}
