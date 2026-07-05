import { LuLoaderCircle } from 'react-icons/lu';

export default function Loader() {
  return (
    <div className="flex h-full items-center justify-center pt-8">
      <LuLoaderCircle className="animate-spin" />
    </div>
  );
}
