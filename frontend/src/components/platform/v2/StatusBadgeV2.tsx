type StatusV2 = 'active' | 'archived' | 'inactive'

const LABEL: Record<StatusV2, string> = {
  active: 'Activo',
  archived: 'Archivado',
  inactive: 'Inactivo',
}

export function StatusBadgeV2({ status }: { status: StatusV2 }) {
  return <span className={'badge ' + status}>{LABEL[status]}</span>
}
