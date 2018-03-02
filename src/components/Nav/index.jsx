import React from 'react'
import { navigateTo } from 'gatsby-link'
import { IconButton, Drawer, Avatar, List, ListItem, Divider } from 'material-ui'
import NavigationMenu from 'material-ui/svg-icons/navigation/menu'
import ActionHome from 'material-ui/svg-icons/action/home'
import ContentArchive from 'material-ui/svg-icons/content/archive'
import ActionClass from 'material-ui/svg-icons/action/class'
import SocialPerson from 'material-ui/svg-icons/social/person'
import ContentLink from 'material-ui/svg-icons/content/link'
import CommunicationRssFeed from 'material-ui/svg-icons/communication/rss-feed'
import navBg from '../../static/nav-bg.png'

export default class Nav extends React.Component {

    state = {
        navVisible: false
    }

    toggleDrawer(e) {
        this.setState({
            navVisible: !this.state.navVisible
        })
    }

    routeTo(route) {
        navigateTo(route);
        this.toggleDrawer();
    }

    rssFeed() {
        this.toggleDrawer();
        window.location.href = '/rss.xml';
    }

    render() {
        return (
            <div>
                <IconButton onClick={this.toggleDrawer.bind(this)} style={{position: 'fixed', top: '20px', left: '10px'}}>
                    <NavigationMenu />
                </IconButton>
                <Drawer 
                    docked={false} 
                    open={this.state.navVisible}
                    onRequestChange={(navVisible) => this.setState({navVisible})}
                >
                    <div style={{height: 160, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundImage: `url(${navBg})`, backgroundSize: 'auto 180px'}}>
                        <Avatar size={60} style={{margin: '0 auto'}}>C</Avatar>
                    </div>
                    <List>
                        <ListItem 
                            primaryText="Home" 
                            leftIcon={<ActionHome />} 
                            onClick={() => this.routeTo('/')} 
                        />
                        {/* <ListItem 
                            primaryText="Archives" 
                            leftIcon={<ContentArchive />} 
                            onClick={() => this.routeTo('/archives')} 
                        /> */}
                        <ListItem 
                            primaryText="Tags" 
                            leftIcon={<ActionClass />} 
                            onClick={() => this.routeTo('/tags')} 
                        />
                    </List>
                    <Divider />
                    <List>
                        <ListItem 
                            primaryText="About" 
                            leftIcon={<SocialPerson />} 
                            onClick={() => this.routeTo('/about')} 
                        />
                        <ListItem 
                            primaryText="Links" 
                            leftIcon={<ContentLink />} 
                            onClick={() => this.routeTo('/links')} 
                        />
                    </List>
                    <Divider />
                    <List>
                        <ListItem 
                            primaryText="RSS" 
                            leftIcon={<CommunicationRssFeed />} 
                            onClick={this.rssFeed.bind(this)}
                        />
                    </List>
                </Drawer>
            </div>
        )
    }
}
