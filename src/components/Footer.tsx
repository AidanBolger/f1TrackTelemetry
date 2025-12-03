import React from 'react'
import './Footer.css'

export default function Footer() {
  const gitUrl = 'https://github.com/AidanBolger'
  const websiteUrl = 'https://aidanbolger.ca'
  const linkedinUrl = 'https://www.linkedin.com/in/aidan-bolger/'

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="app-footer-links">
          <a href={gitUrl} target="_blank" rel="noopener noreferrer">Git</a>
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer">Website</a>
          <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </div>
        <div className="app-footer-note">Created by Aidan Bolger</div>
      </div>
    </footer>
  )
}
