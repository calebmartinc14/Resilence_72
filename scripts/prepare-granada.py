"""Prepara las capas locales del IGN. Sin --spain, genera los municipios de Granada."""
import json
import sys
from pathlib import Path

from shapely.geometry import MultiPolygon, mapping, shape

source = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
national = "--spain" in sys.argv[2:]
features = source["features"]
if not features or source["numberMatched"] != len(features):
    raise ValueError("Incomplete result from IGN")


def round_coordinates(coordinates):
    """Recorre polígonos y anillos hasta llegar a cada par longitud/latitud."""
    if isinstance(coordinates[0], (int, float)):
        return [round(value, 6) for value in coordinates]
    return [round_coordinates(component) for component in coordinates]


municipalities = []
bounds = []
for feature in features:
    props = feature["properties"]
    if national:
        if props["nationallevelname"] != "Provincia" or props["country"] != "ES":
            raise ValueError("La respuesta contiene recintos fuera del ámbito nacional")
    elif props["codnut3"] != "ES614" or props["nationallevelname"] != "Municipio":
        raise ValueError("La respuesta contiene datos fuera de Granada")
    geometry_source = shape(feature["geometry"])
    if national and geometry_source.geom_type == "MultiPolygon":
        # Conserva siempre la pieza principal, incluso en los recintos más pequeños.
        parts = sorted(geometry_source.geoms, key=lambda part: part.area, reverse=True)
        geometry_source = MultiPolygon([parts[0], *(part for part in parts[1:] if part.area >= 0.00002)])
    simplified = geometry_source.simplify(0.009 if national else 0.00035, preserve_topology=True)
    bounds.append(simplified.bounds)
    geometry = mapping(simplified)
    properties = {"name": props["nameunit"]}
    if national:
        # Coloca la etiqueta dentro de la pieza principal del recinto.
        principal = max(simplified.geoms, key=lambda part: part.area) if simplified.geom_type == "MultiPolygon" else simplified
        label = principal.representative_point()
        properties["label"] = [round(label.x, 5), round(label.y, 5)]
    municipalities.append({
        "type": "Feature",
        "id": props["nationalcode"],
        "properties": properties,
        "geometry": {
            "type": geometry["type"],
            "coordinates": round_coordinates(geometry["coordinates"]),
        },
    })

result = {
    "type": "FeatureCollection",
    "sourceDate": source["timeStamp"],
    # Guardar la extensión evita crear una segunda capa de polígonos solo para medirla.
    "bbox": [min(b[0] for b in bounds), min(b[1] for b in bounds),
             max(b[2] for b in bounds), max(b[3] for b in bounds)],
    "features": municipalities,
}
target = Path(__file__).resolve().parent.parent / "public" / ("espana.geojson" if national else "granada.geojson")
target.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"{len(municipalities)} recintos, {target.stat().st_size} bytes")
