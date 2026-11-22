// Maps between legacy races/classes/sub_classes ids and species/roles/callings.
// All lookups from the content pack (DB catalogs stay until a later drop migration).
import content from './content.js';

const ROLE_TO_CLASS_NAME = {
  Templar: 'Paladin',
  Seer: 'Druid',
};
const CLASS_TO_ROLE_NAME = {
  Paladin: 'Templar',
  Druid: 'Seer',
};

function roleNameForClass(className) {
  return CLASS_TO_ROLE_NAME[className] || className;
}

function classNameForRole(roleName) {
  return ROLE_TO_CLASS_NAME[roleName] || roleName;
}

function speciesAll() {
  return content.species ?? [];
}
function speciesById(id) {
  return speciesAll().find((s) => Number(s.id) === Number(id)) ?? null;
}
function parentSpecies(sp) {
  if (!sp) return null;
  if (sp.parent_id == null) return sp;
  return speciesById(sp.parent_id) ?? sp;
}
function rolesAll() {
  return content.roles ?? [];
}
function roleById(id) {
  return rolesAll().find((r) => Number(r.id) === Number(id)) ?? null;
}
function callingsOf(role) {
  return role?.callings ?? [];
}
function legacyRaces() {
  return content.legacy_races ?? [];
}
function legacySubraces() {
  return content.legacy_subraces ?? [];
}
function legacyClasses() {
  return content.legacy_classes ?? [];
}
function legacySubClasses() {
  return content.legacy_sub_classes ?? [];
}

// Parent species id <-> old races.id (species.sort_order = races.id)
export async function legacyRaceIdForSpecies(speciesId) {
  if (speciesId == null) return null;
  const sp = speciesById(speciesId);
  if (!sp) return null;
  const parent = parentSpecies(sp);
  return parent?.sort_order != null ? Number(parent.sort_order) : null;
}

export async function legacySubraceIdForSpecies(speciesId) {
  if (speciesId == null) return null;
  const child = speciesById(speciesId);
  if (!child?.parent_id) return null;
  const parent = speciesById(child.parent_id);
  if (!parent) return null;
  const raceId = parent.sort_order;
  const sr = legacySubraces().find(
    (s) => Number(s.race_id) === Number(raceId) && String(s.name).toLowerCase() === String(child.name).toLowerCase()
  );
  return sr?.id ?? null;
}

export async function legacyClassIdForRole(roleId) {
  if (roleId == null) return null;
  const role = roleById(roleId);
  if (!role) return null;
  const className = classNameForRole(role.name);
  const cl = legacyClasses().find((c) => String(c.name).toLowerCase() === String(className).toLowerCase());
  return cl?.id ?? null;
}

export async function roleIdForLegacyClass(classId) {
  if (classId == null) return null;
  const cl = legacyClasses().find((c) => Number(c.id) === Number(classId));
  if (!cl) return null;
  const roleName = roleNameForClass(cl.name);
  const role = rolesAll().find((r) => String(r.name).toLowerCase() === String(roleName).toLowerCase());
  return role?.id ?? null;
}

export async function legacySubclassIdForCalling(callingId) {
  if (callingId == null) return null;
  for (const role of rolesAll()) {
    const ca = callingsOf(role).find((c) => Number(c.id) === Number(callingId));
    if (!ca) continue;
    const className = classNameForRole(role.name);
    const cl = legacyClasses().find((c) => String(c.name).toLowerCase() === String(className).toLowerCase());
    if (!cl) return null;
    const sc = legacySubClasses().find(
      (s) => Number(s.class_id) === Number(cl.id) && String(s.name).toLowerCase() === String(ca.name).toLowerCase()
    );
    return sc?.id ?? null;
  }
  return null;
}

export { roleNameForClass, classNameForRole };