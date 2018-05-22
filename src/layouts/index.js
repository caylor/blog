import React from 'react'
import PropTypes from 'prop-types'
import Helmet from 'react-helmet'
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'

import Nav from '../components/Nav'
import './index.css'

export default ({ children, data }) => (
    <MuiThemeProvider>
        <div style={{ backgroundColor: '#f5f7f9' }}>
            <Helmet
                title={data.site.siteMetadata.title}
                meta={[
                    { name: 'description', content: "Caylor's blog" },
                    {
                        name: 'keywords',
                        content: 'gatsby, react, material, blog, caylor, Caylor'
                    }
                ]}
            />
            <Nav />
            <div
                style={{
                    margin: '0 auto',
                    maxWidth: 900,
                    minHeight: 500,
                    paddingTop: '100px'
                }}
            >
                {children()}
            </div>
            <div
                style={{
                    backgroundColor: '#fff',
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '15px',
                    color: '#9e9e9e',
                    marginTop: '100px',
                    padding: '40px 0',
                    textAlign: 'center',
                    boxShadow:
                        'rgba(0, 0, 0, 0.12) 0px 1px 6px, rgba(0, 0, 0, 0.12) 0px 1px 4px'
                }}
            >
                <div id="copyright">Copyright © { new Date().getFullYear() } Caylor's Blog</div>
                <div id="power">
                    Based On
                    <a
                        href="https://github.com/caylor/gatsby-material-tsc-starter"
                        target="_blank"
                        style={{
                            color: '#6b6b6b',
                            textDecoration: 'none',
                            fontWeight: 'bold'
                        }}
                    >
                        &nbsp;Gatsby Material Starter
                    </a>
                </div>
            </div>
        </div>
    </MuiThemeProvider>
)

export const query = graphql`
    query LayoutQuery {
        site {
            siteMetadata {
                title
            }
        }
    }
`
