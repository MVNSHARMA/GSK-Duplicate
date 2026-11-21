import React from 'react';

const SkeletonBase = ({ className = '', style }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} style={style} />
);

export const PageLoading = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 gap-4">
    <div className="w-10 h-10 border-4 border-gray-200 border-t-primary rounded-full animate-spin"></div>
    <div className="text-sm font-medium text-gray-500 animate-pulse">Loading...</div>
  </div>
);

export const TableSkeleton = ({ rows = 5, columns = 5 }) => (
  <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="border-b border-gray-100 bg-gray-50/50 p-4 flex gap-4">
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonBase key={`th-${i}`} className="h-4 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={`tr-${i}`} className="border-b border-gray-50 p-4 flex gap-4">
        {Array.from({ length: columns }).map((_, j) => (
          <SkeletonBase key={`td-${i}-${j}`} className="h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export const CardSkeleton = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
    <SkeletonBase className="h-6 w-1/3" />
    <SkeletonBase className="h-10 w-full" />
    <div className="flex gap-2">
      <SkeletonBase className="h-4 w-1/4" />
      <SkeletonBase className="h-4 w-1/4" />
    </div>
  </div>
);

export const FormSkeleton = ({ fields = 4 }) => (
  <div className="flex flex-col gap-6 w-full">
    {Array.from({ length: fields }).map((_, i) => (
      <div key={`f-${i}`} className="flex flex-col gap-2">
        <SkeletonBase className="h-4 w-1/4" />
        <SkeletonBase className="h-10 w-full" />
      </div>
    ))}
    <SkeletonBase className="h-12 w-full sm:w-1/3 mt-4" />
  </div>
);

export const ButtonLoading = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);
