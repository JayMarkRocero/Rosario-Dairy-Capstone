export function ModuleSubheading({ description }: { description: string }) {
  return <p className="text-xs text-slate-500 font-normal mt-1 mb-3 hidden md:block min-w-0 flex-1 self-start truncate" title={description}>{description}</p>;
}
