import React, { useState } from "react";
import { Container, Card } from "react-bootstrap";
import NavBar from "./NavBar"
import CardClassifier from "./CardClassifier";

function App() {
  const [activeSection, setActiveSection] = useState('');

  const selectActiveSelection = (section) => {
    if (section === activeSection) {
      setActiveSection('');
    }
    else {
      setActiveSection(section);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <NavBar onSelect={selectActiveSelection} />
      <CardClassifier />
      <hr />
      {activeSection === 'directions' && <Directions />}
      {activeSection === 'about' && <About />}
      {activeSection === 'legal' && <Legal />}
    </div>
  );
}

const Directions = () => {
  return (
    <Container className="py-4">
      <h1 className="text-center mb-4">Directions</h1>
      <Card className="mb-4">
        <Card.Body>
          <Card.Text>
            Instructions go here...
          </Card.Text>
        </Card.Body>
      </Card>
    </Container>
  )
};
const About = () => {
  return (
    <Container className="py-4">
      <h1 className="text-center mb-4">About</h1>
      <Card className="mb-4">
        <Card.Body>
          <Card.Text>
            This app classifies playing cards using machine learning.
          </Card.Text>
        </Card.Body>
      </Card>
    </Container>
  )
};
const Legal = () => {
  return (
    <Container className="py-4">
      <h1 className="text-center mb-4">Legal</h1>
      <Card className="mb-4">
        <Card.Body>
          <Card.Text>
            Submitted images may be used to improve the classifier.
          </Card.Text>
        </Card.Body>
      </Card>
    </Container>
  )
};

export default App;