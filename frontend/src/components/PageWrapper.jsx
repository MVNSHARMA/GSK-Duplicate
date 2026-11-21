import React from 'react';

const PageWrapper = ({ children, className = "" }) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};

export default PageWrapper;
