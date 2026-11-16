import React, { useState, useEffect } from 'react';
import { getInitialsFromName } from '../../utils/helpers';

export default function UserAvatar({
  src,
  name,
  className = 'w-10 h-10',
  rounded = 'rounded-full',
  ringClass = 'ring-2 ring-cyan-500/40',
  textClass = 'text-xs'
}) {
  const [hasError, setHasError] = useState(false);
  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        className={`${className} ${rounded} ${ringClass} bg-gradient-to-br from-indigo-600 via-indigo-500 to-cyan-500 flex items-center justify-center font-black text-white ${textClass} shrink-0 select-none shadow-md`}
        title={name}
      >
        {getInitialsFromName(name)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name || 'Profil'}
      onError={() => setHasError(true)}
      className={`${className} ${rounded} ${ringClass} object-cover shrink-0 bg-slate-900 shadow-md`}
    />
  );
}