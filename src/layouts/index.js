import React from 'react'
import PropTypes from 'prop-types'
import Helmet from 'react-helmet'
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'

import Nav from '../components/Nav'
import './index.css'

export default ({ children, data }) => (
    <MuiThemeProvider>
        <div>
            <Helmet
                title={data.site.siteMetadata.title}
                meta={[
                    { name: 'description', content: 'Sample' },
                    { name: 'keywords', content: 'sample, something' },
                ]}
            />
            <Nav />
            <div
                style={{
                  margin: '0 auto',
                  maxWidth: 900,
                  paddingTop: '100px',
                }}
            >
                {children()}
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
