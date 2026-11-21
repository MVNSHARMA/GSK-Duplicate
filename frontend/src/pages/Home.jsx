import React from 'react';
import Hero from '../components/Hero';
import About from '../components/About';
import Services from '../components/Services';

import PageWrapper from '../components/PageWrapper';

const Home = () => {
  return (
    <PageWrapper>
      <Hero />
      <About />
      <Services />
    </PageWrapper>
  );
};

export default Home;