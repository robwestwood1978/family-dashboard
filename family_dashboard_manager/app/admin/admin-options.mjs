export function adminRoomOptions(config, current) {
  const floors = new Map((config?.floorplan?.floors || []).map((floor) => [floor.id, floor.name]));
  const defaultFloor = config?.floorplan?.default_floor;
  const options = (config?.rooms || [])
    .filter((room) => room?.id && (!defaultFloor || room.floor_id === defaultFloor))
    .map((room) => {
      const floor = floors.get(room.floor_id);
      const name = room.name || room.id;
      return [room.id, floor ? `${name} · ${floor}` : name];
    });

  if (current && !options.some(([value]) => value === current)) {
    options.unshift([current, `${current} (currently configured)`]);
  }

  return options;
}
